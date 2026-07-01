import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { adminEmails } from "@/lib/admin";
import { db } from "@/lib/db";

import { isInternalEmail } from "@llmchat/shared";

import type { AppContext } from "@/env";
import type { Context } from "hono";

/** The signed-in user plus whether they're a PLATFORM admin. */
export interface AdminIdentity {
	userId: string;
	email: string;
	isAdmin: boolean;
}

/**
 * Resolve the session and whether the user is a platform admin. A user is an
 * admin when EITHER:
 *   (a) their email is on the `ADMIN_EMAILS` allowlist (bootstrap — no DB write
 *       needed, so the first operator can always get in), or
 *   (b) their DB `user.role` is `'admin'`.
 *
 * The role read is scoped to the single `role` column and wrapped defensively:
 * a preview DB that skipped the 0017 migration has no such column, so a failed
 * read degrades to "not an admin via role" (the allowlist path still works)
 * rather than 500-ing the route. Returns null when there is no session at all.
 */
export async function resolveAdminIdentity(
	c: Context<AppContext>,
): Promise<AdminIdentity | null> {
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return null;

	const { id: userId, email } = session.user;

	// (a) env allowlist — no DB read.
	if (isInternalEmail(email, adminEmails(c.env))) {
		return { userId, email, isAdmin: true };
	}

	// (b) DB role — column-scoped + fault-tolerant (see doc comment).
	let roleIsAdmin = false;
	try {
		const row = await db(c.env).query.user.findFirst({
			where: (u, { eq: e }) => e(u.id, userId),
			columns: { role: true },
		});
		roleIsAdmin = row?.role === "admin";
	} catch {
		roleIsAdmin = false;
	}
	return { userId, email, isAdmin: roleIsAdmin };
}

/**
 * Gate a route group to platform admins only. 401 when unauthenticated, 403
 * when authenticated but not an admin (deny-by-default). Caches `userId` on the
 * context for downstream handlers.
 */
export const requireGlobalAdmin = createMiddleware<AppContext>(
	async (c, next) => {
		const identity = await resolveAdminIdentity(c);
		if (!identity) return c.json({ error: "unauthorized" }, 401);
		if (!identity.isAdmin) {
			return c.json({ error: "forbidden", code: "not_admin" }, 403);
		}
		c.set("userId", identity.userId);
		return next();
	},
);
