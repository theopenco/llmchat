import { APIError } from "better-auth";
import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { db } from "@/lib/db";

import type { AppContext, Role } from "@/env";
import type { Context } from "hono";

/**
 * Append every Set-Cookie that getSession emitted — the once-per-updateAge
 * refresh re-stamp, or a dead-cookie clearing — onto `res`. A response that
 * sets a session token must never be stored by a shared cache (the Ploy edge
 * demonstrably rewrites cache headers — see the /widget.js note in AGENTS.md),
 * so any response this touches is also stamped no-store: the business-route
 * counterpart of the /api/auth/* middleware in index.ts.
 */
export function forwardAuthCookies(res: Response, from?: Headers) {
	const cookies = from?.getSetCookie() ?? [];
	for (const v of cookies) {
		res.headers.append("set-cookie", v);
	}
	if (cookies.length > 0) {
		res.headers.set("cache-control", "no-store");
	}
}

export const requireSession = createMiddleware<AppContext>(async (c, next) => {
	const auth = createAuth(c.env);
	let session: Awaited<ReturnType<typeof auth.api.getSession>>;
	let authHeaders: Headers | undefined;
	try {
		({ headers: authHeaders, response: session } = await auth.api.getSession({
			headers: c.req.raw.headers,
			// Better Auth's once-per-updateAge session refresh runs INSIDE
			// getSession and emits the re-stamped session cookie (fresh Max-Age)
			// into these headers. This middleware is by far its busiest caller
			// (the inbox polls every /api/* request through here), so it wins the
			// once-a-day refresh race almost every time — without forwarding the
			// cookie below, the refresh is consumed server-side, the browser keeps
			// the Max-Age stamped at sign-in, and every active user is hard
			// signed out exactly 7 days after signing in.
			returnHeaders: true,
		}));
	} catch (err) {
		// getSession THROWS (rather than returning null) when its refresh loses a
		// race with a concurrent session revocation. That's an unauthenticated
		// outcome, not a server fault — take the same 401 as the null path
		// instead of bubbling a 500.
		if (err instanceof APIError && err.statusCode === 401) {
			return c.json({ error: "unauthorized", code: "unauthorized" }, 401);
		}
		throw err;
	}
	if (!session) {
		const res = c.json({ error: "unauthorized", code: "unauthorized" }, 401);
		// getSession clears a cookie it rejected (missing/expired row); forward
		// the clearing so the browser drops the dead token too.
		forwardAuthCookies(res, authHeaders);
		return res;
	}
	c.set("userId", session.user.id);
	await next();
	forwardAuthCookies(c.res, authHeaders);
	return;
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
		// Member rows can be inserted outside the app (prod has hand-inserted
		// rows), so `result` may hold a string outside the Role enum. An unknown
		// role must rank BELOW every gate — without the ?? 0, its undefined rank
		// makes the < comparison false and the gate silently passes.
		if ((ROLE_RANK[result] ?? 0) < ROLE_RANK[min]) {
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
