import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { fetchUrlContent } from "@/lib/fetch-url";
import { requireSession, requireWorkspace } from "@/middleware/session";

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
	.post(
		"/projects/:projectId/sources",
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
	.patch(
		"/projects/:projectId/sources/:id",
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
	.post("/projects/:projectId/sources/:id/refresh", async (c) => {
		const { projectId, id } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await ensureProject(c.env, projectId, workspaceId);
		if (!proj) return c.json({ error: "not found" }, 404);
		const existing = await db(c.env).query.source.findFirst({
			where: (s, { and: a, eq: e }) =>
				a(e(s.id, id), e(s.projectId, projectId)),
		});
		if (!existing) return c.json({ error: "not found" }, 404);

		const fetched = await tryFetch(existing.url);
		const [updated] = await db(c.env)
			.update(source)
			.set({
				title: fetched.error ? existing.title : fetched.title || existing.title,
				content: fetched.error ? existing.content : fetched.content,
				lastError: fetched.error,
				lastFetchedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(and(eq(source.id, id), eq(source.projectId, projectId)))
			.returning();
		return c.json({ source: updated });
	})
	.delete("/projects/:projectId/sources/:id", async (c) => {
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
	});
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
