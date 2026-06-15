import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSession, requireWorkspace } from "@/middleware/session";

import { eq, project } from "@llmchat/db";

import type { AppContext } from "@/env";

const projectInput = z.object({
	name: z.string().min(1),
	systemPrompt: z.string().default(""),
	activeSystemPromptId: z.string().nullable().optional(),
	knowledgeText: z.string().default(""),
	model: z.string().default("gpt-4.1-mini"),
	brandColor: z.string().default("#000000"),
	welcomeMessage: z.string().default("Hi! How can I help you today?"),
	escalationThreshold: z.number().int().min(1).default(3),
	notifyEmail: z.email().nullable().optional(),
	slackWebhookUrl: z.url().nullable().optional(),
	favorite: z.boolean().optional(),
	pinned: z.boolean().optional(),
});

function generatePublicKey() {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return `pk_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function generateInboundLocal() {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const projects = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/projects", async (c) => {
		const workspaceId = c.get("workspaceId");
		const rows = await db(c.env).query.project.findMany({
			where: (pt, { eq: e }) => e(pt.workspaceId, workspaceId),
		});
		return c.json({ projects: rows });
	})
	.post("/projects", zValidator("json", projectInput), async (c) => {
		const workspaceId = c.get("workspaceId");
		const data = c.req.valid("json");
		const [created] = await db(c.env)
			.insert(project)
			.values({
				...data,
				workspaceId,
				publicKey: generatePublicKey(),
				inboundEmailLocal: generateInboundLocal(),
			})
			.returning();
		return c.json({ project: created });
	})
	.patch(
		"/projects/:id",
		zValidator("json", projectInput.partial()),
		async (c) => {
			const { id } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const data = c.req.valid("json");
			const existing = await db(c.env).query.project.findFirst({
				where: (pt, { and, eq: e }) =>
					and(e(pt.id, id), e(pt.workspaceId, workspaceId)),
			});
			if (!existing) {
				return c.json({ error: "not found" }, 404);
			}
			const [updated] = await db(c.env)
				.update(project)
				.set(data)
				.where(eq(project.id, id))
				.returning();
			return c.json({ project: updated });
		},
	)
	.delete("/projects/:id", async (c) => {
		const { id } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const existing = await db(c.env).query.project.findFirst({
			where: (pt, { and, eq: e }) =>
				and(e(pt.id, id), e(pt.workspaceId, workspaceId)),
		});
		if (!existing) {
			return c.json({ error: "not found" }, 404);
		}
		await db(c.env).delete(project).where(eq(project.id, id));
		return c.json({ ok: true });
	});
