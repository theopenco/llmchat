import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import {
	MAX_MATCH_CONVERSATIONS,
	buildSnippet,
	includesCI,
	likeContains,
} from "@/lib/search";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import {
	and,
	asc,
	conversation,
	desc,
	eq,
	inArray,
	message as messageTable,
	or,
	readStatus,
} from "@llmchat/db";

import type { AppContext } from "@/env";

/** Why a conversation surfaced in a search: an excerpt of the hit and which
 * field it came from, so the agent sees the reason in the list. */
type SearchMatch = { field: "body" | "name" | "email"; snippet: string };

export const conversations = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get(
		"/projects/:projectId/conversations",
		zValidator(
			"query",
			z.object({
				search: z.string().optional(),
				archived: z.enum(["true", "false"]).optional(),
				limit: z.coerce.number().int().min(1).max(100).default(50),
				offset: z.coerce.number().int().min(0).default(0),
			}),
		),
		async (c) => {
			const { projectId } = c.req.param();
			const { search, archived, limit, offset } = c.req.valid("query");
			const workspaceId = c.get("workspaceId");
			const userId = c.get("userId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}

			const term = search?.trim() ?? "";

			const conditions = [eq(conversation.projectId, projectId)];
			if (archived === "true") {
				conditions.push(
					// archivedAt IS NOT NULL
					// drizzle has isNotNull but we can also do gte epoch 0
					// keep simple:
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					eq(conversation.archivedAt, conversation.archivedAt) as any,
				);
			}

			// Content search: a conversation matches on visitor name, email, OR any
			// message body. The message match is scoped to THIS project via a join
			// to conversation (never an unscoped scan of every workspace's
			// messages), bounded, and resolved into the conversation set BEFORE
			// pagination so search spans the whole project, not just the first page.
			if (term) {
				const bodyMatches = await db(c.env)
					.selectDistinct({ id: messageTable.conversationId })
					.from(messageTable)
					.innerJoin(
						conversation,
						eq(messageTable.conversationId, conversation.id),
					)
					.where(
						and(
							eq(conversation.projectId, projectId),
							likeContains(messageTable.content, term),
						),
					)
					.limit(MAX_MATCH_CONVERSATIONS);
				const bodyMatchIds = bodyMatches.map((m) => m.id);

				const orParts = [
					likeContains(conversation.name, term),
					likeContains(conversation.email, term),
				];
				if (bodyMatchIds.length) {
					orParts.push(inArray(conversation.id, bodyMatchIds));
				}
				conditions.push(or(...orParts)!);
			}

			const rows = await db(c.env)
				.select()
				.from(conversation)
				.where(and(...conditions))
				.orderBy(desc(conversation.updatedAt))
				.limit(limit)
				.offset(offset);

			// Attach the first visitor message (sequence 1) as a list preview —
			// one bounded query keyed on the page of conversations we're returning.
			const ids = rows.map((r) => r.id);

			// For the page being returned, pull the first message per conversation
			// whose body matched (scoped + bounded to these ids) so each row can show
			// *why* it matched. Ordered by sequence so the snippet is stable.
			const bodyMatchByConv = new Map<string, string>();
			if (term && ids.length) {
				const matchingBodies = await db(c.env)
					.select({
						conversationId: messageTable.conversationId,
						content: messageTable.content,
					})
					.from(messageTable)
					.innerJoin(
						conversation,
						eq(messageTable.conversationId, conversation.id),
					)
					.where(
						and(
							eq(conversation.projectId, projectId),
							inArray(messageTable.conversationId, ids),
							likeContains(messageTable.content, term),
						),
					)
					.orderBy(asc(messageTable.sequence));
				for (const m of matchingBodies) {
					if (!bodyMatchByConv.has(m.conversationId)) {
						bodyMatchByConv.set(m.conversationId, m.content);
					}
				}
			}

			// Classify each returned conversation's match: prefer the message body
			// excerpt (most informative), else flag the name/email hit so the agent
			// still sees why a no-message-match conversation surfaced.
			const matchFor = (r: (typeof rows)[number]): SearchMatch | null => {
				if (!term) return null;
				const body = bodyMatchByConv.get(r.id);
				if (body !== undefined) {
					return { field: "body", snippet: buildSnippet(body, term) };
				}
				if (r.name && includesCI(r.name, term)) {
					return { field: "name", snippet: r.name };
				}
				if (r.email && includesCI(r.email, term)) {
					return { field: "email", snippet: r.email };
				}
				return null;
			};
			const firstMessages = ids.length
				? await db(c.env)
						.select({
							conversationId: messageTable.conversationId,
							content: messageTable.content,
						})
						.from(messageTable)
						.where(
							and(
								inArray(messageTable.conversationId, ids),
								eq(messageTable.sequence, 1),
							),
						)
				: [];
			const firstByConv = new Map(
				firstMessages.map((m) => [m.conversationId, m.content]),
			);

			// Per-viewer read state: a conversation is unread when this user has
			// seen fewer messages than it currently has (or never opened it).
			const reads = ids.length
				? await db(c.env)
						.select({
							conversationId: readStatus.conversationId,
							lastReadMessageCount: readStatus.lastReadMessageCount,
						})
						.from(readStatus)
						.where(
							and(
								eq(readStatus.userId, userId),
								inArray(readStatus.conversationId, ids),
							),
						)
				: [];
			const readByConv = new Map(
				reads.map((r) => [r.conversationId, r.lastReadMessageCount]),
			);

			return c.json({
				conversations: rows.map((r) => ({
					...r,
					firstMessage: firstByConv.get(r.id) ?? null,
					unread: (readByConv.get(r.id) ?? 0) < r.messageCount,
					match: matchFor(r),
				})),
			});
		},
	)
	.get("/projects/:projectId/conversations/:id", async (c) => {
		const { projectId, id } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { and: a, eq: e }) =>
				a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
		});
		if (!proj) {
			return c.json({ error: "not found" }, 404);
		}
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(e(ct.id, id), e(ct.projectId, projectId)),
		});
		if (!conv) {
			return c.json({ error: "not found" }, 404);
		}
		const messages = await db(c.env).query.message.findMany({
			where: (mt, { eq: e }) => e(mt.conversationId, id),
			orderBy: (mt, ops) => ops.asc(mt.sequence),
		});
		return c.json({ conversation: conv, messages });
	})
	.post(
		"/projects/:projectId/conversations/:id/reply",
		zValidator("json", z.object({ content: z.string().min(1) })),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { content } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and: a, eq: e }) =>
					a(e(ct.id, id), e(ct.projectId, projectId)),
			});
			if (!conv) {
				return c.json({ error: "not found" }, 404);
			}

			const nextSeq = conv.messageCount + 1;
			const messageId = `${crypto.randomUUID()}@${c.env.vars.INBOUND_EMAIL_DOMAIN}`;

			await db(c.env).insert(messageTable).values({
				conversationId: conv.id,
				role: "admin",
				content,
				sequence: nextSeq,
				authorUserId: userId,
				emailMessageId: messageId,
			});
			await db(c.env)
				.update(conversation)
				.set({ messageCount: nextSeq, updatedAt: new Date() })
				.where(eq(conversation.id, conv.id));

			if (conv.email) {
				await sendEmail(c.env, {
					to: conv.email,
					subject: `Re: your support conversation`,
					html: `<p>${escapeHtml(content)}</p>`,
					text: content,
					replyTo: buildReplyToAddress(c.env, proj.inboundEmailLocal),
					headers: { "Message-ID": `<${messageId}>` },
				});
			}

			return c.json({ ok: true });
		},
	)
	.patch(
		"/projects/:projectId/conversations/:id",
		zValidator(
			"json",
			z.object({
				archived: z.boolean().optional(),
				read: z.boolean().optional(),
			}),
		),
		async (c) => {
			const { projectId, id } = c.req.param();
			const { archived, read } = c.req.valid("json");
			const userId = c.get("userId");
			const workspaceId = c.get("workspaceId");

			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}

			if (archived !== undefined) {
				await db(c.env)
					.update(conversation)
					.set({ archivedAt: archived ? new Date() : null })
					.where(eq(conversation.id, id));
			}
			if (read) {
				const conv = await db(c.env).query.conversation.findFirst({
					where: (ct, { eq: e }) => e(ct.id, id),
				});
				if (conv) {
					const existing = await db(c.env).query.readStatus.findFirst({
						where: (rt, { and: a, eq: e }) =>
							a(e(rt.conversationId, id), e(rt.userId, userId)),
					});
					if (existing) {
						await db(c.env)
							.update(readStatus)
							.set({
								lastReadMessageCount: conv.messageCount,
								readAt: new Date(),
							})
							.where(eq(readStatus.id, existing.id));
					} else {
						await db(c.env).insert(readStatus).values({
							conversationId: id,
							userId,
							lastReadMessageCount: conv.messageCount,
						});
					}
				}
			}

			return c.json({ ok: true });
		},
	)
	.delete(
		"/projects/:projectId/conversations/:id",
		requireRole("admin"),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await db(c.env).query.project.findFirst({
				where: (pt, { and: a, eq: e }) =>
					a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
			});
			if (!proj) {
				return c.json({ error: "not found" }, 404);
			}
			await db(c.env).delete(conversation).where(eq(conversation.id, id));
			return c.json({ ok: true });
		},
	);
