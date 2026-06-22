import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { fetchUrlContent } from "@/lib/fetch-url";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import { and, eq, source } from "@llmchat/db";

import type { AppContext } from "@/env";

const createInput = z.object({
	url: z.url(),
	title: z.string().max(200).optional(),
	active: z.boolean().optional(),
});

const updateInput = z.object({
	url: z.url().optional(),
	title: z.string().max(200).optional(),
	active: z.boolean().optional(),
});

// Length caps for a promoted Q&A. Answers can be a real support reply, so the
// budget is generous; questions are a single visitor turn, so tighter. Both are
// also defensively re-clamped server-side for the DERIVED defaults (an absent
// override isn't validated by the schema).
const QUESTION_MAX = 2_000;
const ANSWER_MAX = 8_000;
const TITLE_LEN = 60;

// Manual non-URL source inputs (admin authoring, siblings of the URL create).
// A text snippet gets a generous body; a hand-written Q&A reuses the promote
// caps so the two Q&A creation paths can't diverge. Titles cap at the
// URL-source title limit.
const SNIPPET_MAX = 50_000;
const INPUT_TITLE_MAX = 200;

const textInput = z.object({
	title: z.string().max(INPUT_TITLE_MAX).optional(),
	content: z.string().min(1).max(SNIPPET_MAX),
});

const qaInput = z.object({
	question: z.string().min(1).max(QUESTION_MAX),
	answer: z.string().min(1).max(ANSWER_MAX),
});

// Promote-a-reply input. A purpose-built CREATE schema with the required key
// (`messageId`) — NOT a `.partial()` of some other schema, and with NO
// `.default()` anywhere (the Zod-v4 footgun where a default fires on an absent
// key under `.partial()` and clobbers siblings). `question`/`answer` are honest
// optionals: absent ⇒ derive the default server-side; present ⇒ override.
const promoteInput = z.object({
	messageId: z.string().min(1),
	question: z.string().max(QUESTION_MAX).optional(),
	answer: z.string().max(ANSWER_MAX).optional(),
});

async function ensureProject(
	env: AppContext["Bindings"],
	projectId: string,
	workspaceId: string,
) {
	return db(env).query.project.findFirst({
		where: (pt, { and: a, eq: e }) =>
			a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
	});
}

export const sources = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/projects/:projectId/sources", async (c) => {
		const { projectId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await ensureProject(c.env, projectId, workspaceId);
		if (!proj) return c.json({ error: "not found" }, 404);
		const rows = await db(c.env).query.source.findMany({
			where: (s, { eq: e }) => e(s.projectId, projectId),
			orderBy: (s, { desc, asc }) => [desc(s.active), asc(s.createdAt)],
		});
		return c.json({ sources: rows });
	})
	// Promote an inbox reply into a Q&A knowledge source the agent learns from.
	// Minimum role `agent` (any workspace member): handling conversations is an
	// agent's job, so turning a good reply into knowledge is too — deliberately
	// looser than the admin-only URL-source mutations above.
	.post(
		"/projects/:projectId/sources/promote",
		requireRole("agent"),
		zValidator("json", promoteInput),
		async (c) => {
			const { projectId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const { messageId, question, answer } = c.req.valid("json");

			// Tenant isolation (deliberate, step by step — we've shipped a
			// cross-tenant bug before): the project must belong to the caller's
			// workspace, the message must exist, and its conversation must belong to
			// THIS project. Any miss ⇒ 404 (never reveal another tenant's data, and
			// never let a foreign messageId be promoted into this project).
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);

			const msg = await db(c.env).query.message.findFirst({
				where: (mt, { eq: e }) => e(mt.id, messageId),
			});
			if (!msg) return c.json({ error: "not found" }, 404);

			const conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { eq: e }) => e(ct.id, msg.conversationId),
			});
			if (!conv || conv.projectId !== projectId) {
				return c.json({ error: "not found" }, 404);
			}

			// Dedupe on provenance: re-promoting the same reply is a no-op (return the
			// existing source) rather than a duplicate Q&A in the knowledge base.
			const existing = await db(c.env).query.source.findFirst({
				where: (s, { and: a, eq: e }) =>
					a(e(s.projectId, projectId), e(s.sourceMessageId, messageId)),
			});
			if (existing) {
				return c.json({ source: existing, deduped: true });
			}

			// Answer: the override (if any), else the message body. Required non-empty
			// — a blank answer carries no knowledge. Clamp the derived default too
			// (an absent override skips the schema's max).
			const finalAnswer = (answer ?? msg.content).trim().slice(0, ANSWER_MAX);
			if (!finalAnswer) {
				return c.json({ error: "answer required" }, 400);
			}

			// Question: the override if the field was sent at all (empty allowed),
			// else the nearest preceding visitor message in this conversation. A
			// conversation that opens with the bot (no earlier visitor turn) yields an
			// empty question — that's fine, the answer still teaches.
			let finalQuestion: string;
			if (question !== undefined) {
				finalQuestion = question.trim().slice(0, QUESTION_MAX);
			} else {
				const prev = await db(c.env).query.message.findFirst({
					where: (mt, { and: a, eq: e, lt }) =>
						a(
							e(mt.conversationId, msg.conversationId),
							e(mt.role, "user"),
							lt(mt.sequence, msg.sequence),
						),
					orderBy: (mt, { desc: d }) => d(mt.sequence),
				});
				finalQuestion = (prev?.content ?? "").trim().slice(0, QUESTION_MAX);
			}

			const content = `Q: ${finalQuestion}\nA: ${finalAnswer}`;
			// Title from the question (the human-readable handle); fall back to the
			// answer when there's no question, so a qa row is never blank-titled.
			const title = (finalQuestion || finalAnswer).slice(0, TITLE_LEN);

			const [created] = await db(c.env)
				.insert(source)
				.values({
					projectId,
					kind: "qa",
					url: null,
					title,
					content,
					question: finalQuestion,
					answer: finalAnswer,
					sourceMessageId: messageId,
					active: true,
				})
				.returning();
			return c.json({ source: created });
		},
	)
	.post(
		"/projects/:projectId/sources",
		requireRole("admin"),
		zValidator("json", createInput),
		async (c) => {
			const { projectId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const data = c.req.valid("json");

			// Prevent duplicates per project.
			const existing = await db(c.env).query.source.findFirst({
				where: (s, { and: a, eq: e }) =>
					a(e(s.projectId, projectId), e(s.url, data.url)),
			});
			if (existing) {
				return c.json({ error: "url already added", source: existing }, 409);
			}

			const fetched = await tryFetch(data.url);

			const [created] = await db(c.env)
				.insert(source)
				.values({
					projectId,
					url: data.url,
					title: data.title ?? fetched.title,
					content: fetched.content,
					active: data.active ?? true,
					lastFetchedAt: new Date(),
					lastError: fetched.error,
				})
				.returning();
			return c.json({ source: created });
		},
	)
	// Manual non-URL sources — admin authoring siblings of the URL create.
	// "text" is a free-text snippet; "qa" is a hand-written Q&A pair (the same
	// content shape promote produces, but with no message provenance). Both have
	// no url and flow straight into retrieval (chat.ts loads every active source).
	.post(
		"/projects/:projectId/sources/text",
		requireRole("admin"),
		zValidator("json", textInput),
		async (c) => {
			const { projectId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const { title, content } = c.req.valid("json");
			const finalContent = content.trim();
			if (!finalContent) return c.json({ error: "content required" }, 400);
			// Title: the override, else the first chars of the snippet — never blank.
			const finalTitle = (title?.trim() || finalContent).slice(0, TITLE_LEN);
			const [created] = await db(c.env)
				.insert(source)
				.values({
					projectId,
					kind: "text",
					url: null,
					title: finalTitle,
					content: finalContent,
					active: true,
				})
				.returning();
			return c.json({ source: created });
		},
	)
	.post(
		"/projects/:projectId/sources/qa",
		requireRole("admin"),
		zValidator("json", qaInput),
		async (c) => {
			const { projectId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const question = c.req.valid("json").question.trim();
			const answer = c.req.valid("json").answer.trim();
			if (!question || !answer) {
				return c.json({ error: "question and answer required" }, 400);
			}
			const content = `Q: ${question}\nA: ${answer}`;
			const title = question.slice(0, TITLE_LEN);
			const [created] = await db(c.env)
				.insert(source)
				.values({
					projectId,
					kind: "qa",
					url: null,
					title,
					content,
					question,
					answer,
					sourceMessageId: null,
					active: true,
				})
				.returning();
			return c.json({ source: created });
		},
	)
	.patch(
		"/projects/:projectId/sources/:id",
		requireRole("admin"),
		zValidator("json", updateInput),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const existing = await db(c.env).query.source.findFirst({
				where: (s, { and: a, eq: e }) =>
					a(e(s.id, id), e(s.projectId, projectId)),
			});
			if (!existing) return c.json({ error: "not found" }, 404);
			const data = c.req.valid("json");

			// Re-fetch if URL changed.
			let title = data.title ?? existing.title;
			let content = existing.content;
			let lastError: string | null = existing.lastError;
			let lastFetchedAt: Date | null = existing.lastFetchedAt;
			if (data.url && data.url !== existing.url) {
				// Reject if the new URL collides with another source in this project.
				const collision = await db(c.env).query.source.findFirst({
					where: (s, { and: a, eq: e, ne }) =>
						a(e(s.projectId, projectId), e(s.url, data.url!), ne(s.id, id)),
				});
				if (collision) {
					return c.json({ error: "url already added" }, 409);
				}
				const fetched = await tryFetch(data.url);
				title = data.title ?? fetched.title;
				content = fetched.content;
				lastError = fetched.error;
				lastFetchedAt = new Date();
			}

			const [updated] = await db(c.env)
				.update(source)
				.set({
					...data,
					title,
					content,
					lastError,
					lastFetchedAt,
					updatedAt: new Date(),
				})
				.where(and(eq(source.id, id), eq(source.projectId, projectId)))
				.returning();
			return c.json({ source: updated });
		},
	)
	.post(
		"/projects/:projectId/sources/:id/refresh",
		requireRole("admin"),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const existing = await db(c.env).query.source.findFirst({
				where: (s, { and: a, eq: e }) =>
					a(e(s.id, id), e(s.projectId, projectId)),
			});
			if (!existing) return c.json({ error: "not found" }, 404);
			// Only URL sources can be recrawled; qa/text sources have no url to fetch.
			if (!existing.url) {
				return c.json({ error: "source has no url to refresh" }, 400);
			}

			const fetched = await tryFetch(existing.url);
			const [updated] = await db(c.env)
				.update(source)
				.set({
					title: fetched.error
						? existing.title
						: fetched.title || existing.title,
					content: fetched.error ? existing.content : fetched.content,
					lastError: fetched.error,
					lastFetchedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(and(eq(source.id, id), eq(source.projectId, projectId)))
				.returning();
			return c.json({ source: updated });
		},
	)
	.delete(
		"/projects/:projectId/sources/:id",
		requireRole("admin"),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const result = await db(c.env)
				.delete(source)
				.where(and(eq(source.id, id), eq(source.projectId, projectId)))
				.returning({ id: source.id });
			if (result.length === 0) return c.json({ error: "not found" }, 404);
			return c.json({ ok: true });
		},
	);
async function tryFetch(url: string): Promise<{
	title: string;
	content: string;
	error: string | null;
}> {
	try {
		const fetched = await fetchUrlContent(url);
		return { title: fetched.title, content: fetched.content, error: null };
	} catch (e) {
		const error = e instanceof Error ? e.message : "fetch failed";
		console.warn("[sources] fetch failed", { url, error });
		return { title: url, content: "", error };
	}
}
