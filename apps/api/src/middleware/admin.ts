import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { adminEmails, isAdminGranted } from "@/lib/admin";
import { db } from "@/lib/db";

import { eq, sql, user } from "@llmchat/db";

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
 * admin when their email is VERIFIED and EITHER (a) on the `ADMIN_EMAILS`
 * allowlist (bootstrap — no DB write needed) or (b) their DB `role` is 'admin'.
 * The verified-email requirement is the guard against self-registration
 * privilege-escalation (see isAdminGranted).
 *
 * `role` is read via an explicit `sql` projection (NOT a Drizzle column — see
 * schema.ts) so it's the ONLY query that references the column, and the read is
 * wrapped defensively: a preview DB that skipped the 0017 migration has no such
 * column, so a failed read degrades to non-admin (403) rather than 500-ing.
 * Returns null when there is no session at all.
 */
export async function resolveAdminIdentity(
	c: Context<AppContext>,
): Promise<AdminIdentity | null> {
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) return null;

	const { id: userId, email, emailVerified } = session.user;

	// Only read the role once the email is verified — an unverified email can
	// never be an admin (isAdminGranted enforces this), so skip the DB round-trip.
	let role: string | null = null;
	if (emailVerified) {
		try {
			const rows = await db(c.env)
				.select({ role: sql<string>`role` })
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);
			role = rows[0]?.role ?? null;
		} catch {
			role = null;
		}
	}

	return {
		userId,
		email,
		isAdmin: isAdminGranted({
			emailVerified,
			email,
			role,
			allowlist: adminEmails(c.env),
		}),
	};
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
