import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { decodeCursor, encodeCursor } from "@/lib/cursor";
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
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	message as messageTable,
	or,
	readStatus,
	sql,
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
				limit: z.coerce.number().int().min(1).max(100).default(30),
				// Opaque keyset cursor (see lib/cursor). A garbage value decodes to
				// null below and just serves the first page — never a 400.
				cursor: z.string().optional(),
			}),
		),
		async (c) => {
			const { projectId } = c.req.param();
			const { search, archived, limit, cursor } = c.req.valid("query");
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

			// Active vs archived split, server-side and explicit: archived rows have
			// a non-null archivedAt. Default (param absent or "false") is the active
			// view. This goes into the WHERE before LIMIT/OFFSET and composes with
			// the search OR-group below, so search runs within the chosen view.
			const conditions = [
				eq(conversation.projectId, projectId),
				archived === "true"
					? isNotNull(conversation.archivedAt)
					: isNull(conversation.archivedAt),
			];

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

			// Keyset pagination on (updatedAt DESC, id DESC): resume strictly after
			// the cursor row. Raw SQL compares against the stored unix-seconds integer
			// directly, sidestepping the timestamp custom-type's driver mapping. ANDed
			// alongside the project scope, archived filter, and search OR-group — so it
			// composes with all of them. A garbage cursor decoded to null = page 1.
			const cur = decodeCursor(cursor);
			if (cur) {
				conditions.push(
					sql`(${conversation.updatedAt} < ${cur.updatedAt} OR (${conversation.updatedAt} = ${cur.updatedAt} AND ${conversation.id} < ${cur.id}))`,
				);
			}

			// Fetch one extra row to know whether another page exists without a
			// second COUNT query.
			const page = await db(c.env)
				.select()
				.from(conversation)
				.where(and(...conditions))
				.orderBy(desc(conversation.updatedAt), desc(conversation.id))
				.limit(limit + 1);

			const hasMore = page.length > limit;
			const rows = hasMore ? page.slice(0, limit) : page;
			const last = rows.at(-1);
			const nextCursor =
				hasMore && last
					? encodeCursor({
							updatedAt: Math.floor(last.updatedAt.getTime() / 1000),
							id: last.id,
						})
					: null;

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
				nextCursor,
			});
		},
	)
	.get("/projects/:projectId/conversations/stats", async (c) => {
		// True project-wide totals for the inbox header — independent of the
		// search term and the active/archived toggle, so the header is honest
		// even though the list itself paginates (loaded-page counts would read
		// as "so far"). One aggregate row, same ownership chain as the list.
		const { projectId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { and: a, eq: e }) =>
				a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
		});
		if (!proj) {
			return c.json({ error: "not found" }, 404);
		}

		const [agg] = await db(c.env)
			.select({
				total: count(),
				escalated: sql<number>`sum(case when ${conversation.escalatedAt} is not null then 1 else 0 end)`,
				// "Resolved" == archived (the app's only closed state).
				resolved: sql<number>`sum(case when ${conversation.archivedAt} is not null then 1 else 0 end)`,
				// avg() ignores NULL csat, and is NULL when nothing is rated.
				avgRating: sql<number | null>`avg(${conversation.csatRating})`,
			})
			.from(conversation)
			.where(eq(conversation.projectId, projectId));

		return c.json({
			total: agg?.total ?? 0,
			escalated: Number(agg?.escalated ?? 0),
			resolved: Number(agg?.resolved ?? 0),
			avgRating: agg?.avgRating ?? null,
		});
	})
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
