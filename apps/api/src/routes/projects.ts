import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import {
	isModelAllowedForWorkspace,
	projectCount,
	resolveAccess,
} from "@/lib/plan";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import { and, count, eq, gte, project, usageEvent } from "@llmchat/db";
import {
	DEFAULT_MODEL,
	isModelAllowed,
	isPaidPlan,
	isWithinLimit,
} from "@llmchat/shared";

import type { AppContext } from "@/env";

// CREATE keeps the defaults so a project can be made from just `{ name }` — the
// unspecified columns get sensible starting values on insert.
const projectCreateInput = z.object({
	name: z.string().min(1),
	systemPrompt: z.string().default(""),
	activeSystemPromptId: z.string().nullable().optional(),
	knowledgeText: z.string().default(""),
	model: z.string().default(DEFAULT_MODEL),
	brandColor: z.string().default("#000000"),
	welcomeMessage: z.string().default("Hi! How can I help you today?"),
	escalationThreshold: z.number().int().min(1).default(3),
	notifyEmail: z.email().nullable().optional(),
	slackWebhookUrl: z.url().nullable().optional(),
	privacyPolicyUrl: z.url().nullable().optional(),
	favorite: z.boolean().optional(),
	pinned: z.boolean().optional(),
});

// UPDATE must carry NO defaults: in Zod v4 a `.default()` still fires on an
// absent key even under `.partial()`, so reusing the create schema would
// re-materialize every defaulted field on a single-field PATCH and clobber the
// untouched columns (system prompt, model, brand color, …) — and the favorite/
// pin toggle, which sends one key, was wiping the whole config. With no
// defaults, an omitted field stays omitted and `db.update().set()` only writes
// the keys actually provided.
const projectUpdateInput = z.object({
	name: z.string().min(1).optional(),
	systemPrompt: z.string().optional(),
	activeSystemPromptId: z.string().nullable().optional(),
	knowledgeText: z.string().optional(),
	model: z.string().optional(),
	brandColor: z.string().optional(),
	welcomeMessage: z.string().optional(),
	escalationThreshold: z.number().int().min(1).optional(),
	notifyEmail: z.email().nullable().optional(),
	slackWebhookUrl: z.url().nullable().optional(),
	privacyPolicyUrl: z.url().nullable().optional(),
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
	// Per-project response counts for the last 30 days — the projects grid's
	// "responses · 30d" badge. DELIBERATELY a separate endpoint, not folded into
	// GET /projects: that list is on the hot path (inbox, shell switcher,
	// onboarding, workspaces), so it stays lean while the grid lazy-loads these
	// counts. One bounded, indexed (workspace_id, created_at) aggregate grouped by
	// project — no pagination, output is at most the project cap.
	.get("/projects/usage", async (c) => {
		const workspaceId = c.get("workspaceId");
		const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const rows = await db(c.env)
			.select({ projectId: usageEvent.projectId, n: count() })
			.from(usageEvent)
			.where(
				and(
					eq(usageEvent.workspaceId, workspaceId),
					gte(usageEvent.createdAt, since),
				),
			)
			.groupBy(usageEvent.projectId);
		const usage: Record<string, number> = {};
		for (const r of rows) usage[r.projectId] = Number(r.n);
		return c.json({ usage });
	})
	.post(
		"/projects",
		requireRole("admin"),
		zValidator("json", projectCreateInput),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const userId = c.get("userId");
			const data = c.req.valid("json");
			// Paywall (server-side, non-bypassable): a non-exempt workspace with no
			// active subscription can't build at all — paid-only, hard gate before
			// onboarding. Then the per-tier project-count cap and model access.
			const { exempt, plan, entitlements } = await resolveAccess(
				c.env,
				workspaceId,
			);
			if (!exempt && !isPaidPlan(plan)) {
				return c.json({ error: "subscription_required" }, 402);
			}
			const count = await projectCount(c.env, workspaceId);
			if (!isWithinLimit(count, entitlements.maxProjects)) {
				return c.json({ error: "project_limit_reached" }, 402);
			}
			if (!exempt && !isModelAllowed(plan, data.model)) {
				return c.json({ error: "model_not_allowed" }, 402);
			}
			// Escalation alerts work out of the box: when the caller omits
			// notifyEmail, seed it with the creating user's own email so the "Talk
			// to a human" handoff actually reaches someone on day one (still editable
			// later via PATCH / Settings → Behavior). An explicit value — including
			// null to opt out — is always respected. Looking up the caller's OWN
			// session user by id is not a tenant-scoped read, so a bare id match is
			// correct here.
			let notifyEmail = data.notifyEmail;
			if (notifyEmail === undefined) {
				const creator = await db(c.env).query.user.findFirst({
					where: (u, { eq: e }) => e(u.id, userId),
					// Only the email is read below. Scope the projection so this never
					// becomes a `SELECT *` of the user row — a preview DB that skipped
					// migrations may lack newer columns (e.g. `role`).
					columns: { email: true },
				});
				notifyEmail = creator?.email ?? null;
			}
			const [created] = await db(c.env)
				.insert(project)
				.values({
					...data,
					notifyEmail,
					workspaceId,
					publicKey: generatePublicKey(),
					inboundEmailLocal: generateInboundLocal(),
				})
				.returning();
			return c.json({ project: created });
		},
	)
	.patch(
		"/projects/:id",
		requireRole("admin"),
		zValidator("json", projectUpdateInput),
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
			// Gate a model change against the plan's model access (only when the
			// model is actually being changed).
			if (
				data.model &&
				!(await isModelAllowedForWorkspace(c.env, workspaceId, data.model))
			) {
				return c.json({ error: "model_not_allowed" }, 402);
			}
			const [updated] = await db(c.env)
				.update(project)
				.set(data)
				.where(eq(project.id, id))
				.returning();
			return c.json({ project: updated });
		},
	)
	.delete("/projects/:id", requireRole("admin"), async (c) => {
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
