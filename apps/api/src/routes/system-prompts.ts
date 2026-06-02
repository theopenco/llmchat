import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSession, requireWorkspace } from "@/middleware/session";

import { and, eq, project, systemPrompt } from "@llmchat/db";

import type { AppContext } from "@/env";

const promptInput = z.object({
	name: z.string().min(1).max(80),
	content: z.string().default(""),
	favorite: z.boolean().optional(),
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

export const systemPrompts = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/projects/:projectId/system-prompts", async (c) => {
		const { projectId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const proj = await ensureProject(c.env, projectId, workspaceId);
		if (!proj) return c.json({ error: "not found" }, 404);
		const rows = await db(c.env).query.systemPrompt.findMany({
			where: (sp, { eq: e }) => e(sp.projectId, projectId),
			orderBy: (sp, { asc, desc }) => [desc(sp.favorite), asc(sp.createdAt)],
		});
		return c.json({
			prompts: rows,
			activeSystemPromptId: proj.activeSystemPromptId,
		});
	})
	.post(
		"/projects/:projectId/system-prompts",
		zValidator("json", promptInput),
		async (c) => {
			const { projectId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const data = c.req.valid("json");
			const [created] = await db(c.env)
				.insert(systemPrompt)
				.values({ ...data, projectId })
				.returning();
			// First prompt auto-activates.
			if (!proj.activeSystemPromptId && created) {
				await db(c.env)
					.update(project)
					.set({ activeSystemPromptId: created.id })
					.where(eq(project.id, projectId));
			}
			return c.json({ prompt: created });
		},
	)
	.patch(
		"/projects/:projectId/system-prompts/:id",
		zValidator("json", promptInput.partial()),
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const data = c.req.valid("json");
			const [updated] = await db(c.env)
				.update(systemPrompt)
				.set({ ...data, updatedAt: new Date() })
				.where(
					and(eq(systemPrompt.id, id), eq(systemPrompt.projectId, projectId)),
				)
				.returning();
			if (!updated) return c.json({ error: "not found" }, 404);
			return c.json({ prompt: updated });
		},
	)
	.post(
		"/projects/:projectId/system-prompts/:id/activate",
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			const existing = await db(c.env).query.systemPrompt.findFirst({
				where: (sp, { and: a, eq: e }) =>
					a(e(sp.id, id), e(sp.projectId, projectId)),
			});
			if (!existing) return c.json({ error: "not found" }, 404);
			await db(c.env)
				.update(project)
				.set({ activeSystemPromptId: id })
				.where(eq(project.id, projectId));
			return c.json({ ok: true, activeSystemPromptId: id });
		},
	)
	.delete(
		"/projects/:projectId/system-prompts/:id",
		async (c) => {
			const { projectId, id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const proj = await ensureProject(c.env, projectId, workspaceId);
			if (!proj) return c.json({ error: "not found" }, 404);
			await db(c.env)
				.delete(systemPrompt)
				.where(
					and(eq(systemPrompt.id, id), eq(systemPrompt.projectId, projectId)),
				);
			// If the deleted one was active, fall back to another (or null).
			if (proj.activeSystemPromptId === id) {
				const next = await db(c.env).query.systemPrompt.findFirst({
					where: (sp, { eq: e }) => e(sp.projectId, projectId),
					orderBy: (sp, { asc }) => asc(sp.createdAt),
				});
				await db(c.env)
					.update(project)
					.set({ activeSystemPromptId: next?.id ?? null })
					.where(eq(project.id, projectId));
			}
			return c.json({ ok: true });
		},
	);
