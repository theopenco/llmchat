import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { db } from "@/lib/db";

import type { AppContext, Role } from "@/env";
import type { Context } from "hono";

export const requireSession = createMiddleware<AppContext>(async (c, next) => {
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ error: "unauthorized" }, 401);
	}
	c.set("userId", session.user.id);
	return next();
});

/** Role hierarchy: a higher rank includes every capability of the ranks below.
 * owner ⊃ admin ⊃ agent. Centralized so authorization is one comparison, not a
 * scatter of equality checks. */
const ROLE_RANK: Record<Role, number> = { agent: 1, admin: 2, owner: 3 };

/** Look up the caller's membership for the `x-workspace-id` workspace and cache
 * (workspaceId, role) on the context. Returns the role, or a JSON error
 * Response to short-circuit with (400 missing header / 403 not a member). */
async function resolveMembership(
	c: Context<AppContext>,
): Promise<Role | Response> {
	const cachedRole = c.get("role");
	if (cachedRole && c.get("workspaceId")) return cachedRole;

	const userId = c.get("userId");
	const workspaceId = c.req.header("x-workspace-id");
	if (!workspaceId) {
		return c.json({ error: "workspace required" }, 400);
	}
	const m = await db(c.env).query.member.findFirst({
		where: (mt, { and, eq: e }) =>
			and(e(mt.userId, userId), e(mt.workspaceId, workspaceId)),
	});
	if (!m) {
		return c.json({ error: "forbidden" }, 403);
	}
	// role is a non-null enum in practice; coerce a legacy null to the least
	// privileged role so a bad row can never escalate.
	const role = (m.role ?? "agent") as Role;
	c.set("workspaceId", workspaceId);
	c.set("role", role);
	return role;
}

/** Assert the caller is a member of the active workspace (any role). Caches the
 * role so a later requireRole on the same request needs no extra query. */
export const requireWorkspace = createMiddleware<AppContext>(
	async (c, next) => {
		const result = await resolveMembership(c);
		if (result instanceof Response) return result;
		return next();
	},
);

/**
 * Assert the caller's role is at least `min` in the hierarchy. Composes after
 * requireWorkspace (reuses the cached role) or stands alone — billing mounts it
 * without requireWorkspace, so it resolves membership itself when needed.
 *
 * Deny-by-default: an unknown role or missing membership is forbidden.
 */
export function requireRole(min: Role) {
	return createMiddleware<AppContext>(async (c, next) => {
		const result = await resolveMembership(c);
		if (result instanceof Response) return result;
		if (ROLE_RANK[result] < ROLE_RANK[min]) {
			return c.json(
				{ error: "forbidden", code: "insufficient_role", required: min },
				403,
			);
		}
		return next();
	});
}

/** Billing actions — checkout, portal — are owner-only. */
export const requireOwner = requireRole("owner");
