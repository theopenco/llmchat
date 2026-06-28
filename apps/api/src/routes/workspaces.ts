import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { provisionWorkspace } from "@/lib/provisioning";
import {
	assertDeletable,
	deleteWorkspaceCascade,
} from "@/lib/workspace-deletion";
import { requireSession } from "@/middleware/session";

import { count, eq, member, project, workspace } from "@llmchat/db";

import type { AppContext } from "@/env";

export const workspaces = new Hono<AppContext>()
	.use("*", requireSession)
	.get("/workspaces", async (c) => {
		const userId = c.get("userId");
		// Include a per-workspace project count so the dashboard can pick a sensible
		// default workspace (a non-empty, paid one) rather than whichever row sorts
		// first. There's no ORDER BY, so blindly taking the first row could strand a
		// member of a non-empty paid workspace on /onboarding behind an empty one.
		const rows = await db(c.env)
			.select({
				workspace: workspace,
				role: member.role,
				projectCount: count(project.id),
			})
			.from(member)
			.innerJoin(workspace, eq(workspace.id, member.workspaceId))
			.leftJoin(project, eq(project.workspaceId, workspace.id))
			.where(eq(member.userId, userId))
			.groupBy(workspace.id, member.role);
		return c.json({ workspaces: rows });
	})
	.post(
		"/workspaces",
		zValidator("json", z.object({ name: z.string().min(1) })),
		async (c) => {
			const userId = c.get("userId");
			const { name } = c.req.valid("json");
			const ws = await provisionWorkspace(db(c.env), userId, name);
			return c.json({ workspace: ws });
		},
	)
	// Delete a workspace + all its data. OWNER-of-this-workspace only — the role is
	// keyed off the PATH id (not the x-workspace header), so you can only delete a
	// workspace you own. Reuses the PR2 deletion service: the live + fail-closed
	// subscription gate, then the explicit set-based cascade. Never deletes the
	// user or other workspaces.
	.delete("/workspaces/:id", async (c) => {
		const userId = c.get("userId");
		const { id } = c.req.param();

		const owner = await db(c.env).query.member.findFirst({
			where: (m, { and, eq: e }) =>
				and(e(m.userId, userId), e(m.workspaceId, id), e(m.role, "owner")),
		});
		if (!owner) return c.json({ error: "forbidden" }, 403);

		const ws = await db(c.env).query.workspace.findFirst({
			where: (w, { eq: e }) => e(w.id, id),
			columns: { id: true, plan: true, stripeSubscriptionId: true },
		});
		if (!ws) return c.json({ error: "not found" }, 404);

		// Last-workspace guard: never strand the user with no workspace — they must
		// create another (or delete their whole account) instead. Counts the user's
		// total memberships, not just owned ones.
		const [{ n }] = await db(c.env)
			.select({ n: count() })
			.from(member)
			.where(eq(member.userId, userId));
		if (n <= 1) return c.json({ error: "last_workspace" }, 409);

		// Live, fail-closed subscription gate, scoped to THIS workspace only.
		const gate = await assertDeletable([ws], c.env);
		if (gate.blocked) return c.json({ error: gate.reason }, 409);

		await deleteWorkspaceCascade(db(c.env), id);
		return c.json({ ok: true });
	});
