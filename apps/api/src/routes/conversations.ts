import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import { requireSession, requireWorkspace } from "@/middleware/session";

import {
	and,
	conversation,
	desc,
	eq,
	inArray,
	like,
	message as messageTable,
	readStatus,
} from "@llmchat/db";

import type { AppContext } from "@/env";

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

			const rows = await db(c.env)
				.select()
				.from(conversation)
				.where(and(...conditions))
				.orderBy(desc(conversation.updatedAt))
				.limit(limit)
				.offset(offset);

			let filtered = rows;
			if (search) {
				const matchingMessages = await db(c.env)
					.select({ conversationId: messageTable.conversationId })
					.from(messageTable)
					.where(like(messageTable.content, `%${search}%`));
				const matchSet = new Set(matchingMessages.map((m) => m.conversationId));
				filtered = rows.filter((r) => matchSet.has(r.id));
			}

			// Attach the first visitor message (sequence 1) as a list preview —
			// one bounded query keyed on the page of conversations we're returning.
			const ids = filtered.map((r) => r.id);
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
				conversations: filtered.map((r) => ({
					...r,
					firstMessage: firstByConv.get(r.id) ?? null,
					unread: (readByConv.get(r.id) ?? 0) < r.messageCount,
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
			orderBy: (mt, { asc }) => asc(mt.sequence),
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
	.delete("/projects/:projectId/conversations/:id", async (c) => {
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
	});
