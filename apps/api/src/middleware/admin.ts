import { APIError } from "better-auth";
import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { adminEmails, isAdminGranted } from "@/lib/admin";
import { db } from "@/lib/db";
import { forwardAuthCookies } from "@/middleware/session";

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
 * `identity` is null when there is no session at all. `authHeaders` carries
 * whatever Set-Cookie getSession emitted (the once-per-updateAge refresh
 * re-stamp) — callers MUST forward it via forwardAuthCookies, or an admin
 * console winning the refresh race consumes the re-stamp server-side and its
 * operator's cookie hard-expires 7 days after sign-in (the same auto-sign-out
 * bug requireSession fixes).
 */
export async function resolveAdminIdentity(c: Context<AppContext>): Promise<{
	identity: AdminIdentity | null;
	authHeaders?: Headers;
}> {
	const auth = createAuth(c.env);
	let session: Awaited<ReturnType<typeof auth.api.getSession>>;
	let authHeaders: Headers | undefined;
	try {
		({ headers: authHeaders, response: session } = await auth.api.getSession({
			headers: c.req.raw.headers,
			returnHeaders: true,
		}));
	} catch (err) {
		// Same mapping as requireSession: the refresh losing a race with a
		// concurrent revocation is an unauthenticated outcome, not a 500.
		if (err instanceof APIError && err.statusCode === 401) {
			return { identity: null };
		}
		throw err;
	}
	if (!session) return { identity: null, authHeaders };

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
		identity: {
			userId,
			email,
			isAdmin: isAdminGranted({
				emailVerified,
				email,
				role,
				allowlist: adminEmails(c.env),
			}),
		},
		authHeaders,
	};
}

/**
 * Gate a route group to platform admins only. 401 when unauthenticated, 403
 * when authenticated but not an admin (deny-by-default). Caches `userId` on the
 * context for downstream handlers.
 */
export const requireGlobalAdmin = createMiddleware<AppContext>(
	async (c, next) => {
		const { identity, authHeaders } = await resolveAdminIdentity(c);
		if (!identity) {
			const res = c.json({ error: "unauthorized", code: "unauthorized" }, 401);
			forwardAuthCookies(res, authHeaders);
			return res;
		}
		if (!identity.isAdmin) {
			const res = c.json({ error: "forbidden", code: "not_admin" }, 403);
			forwardAuthCookies(res, authHeaders);
			return res;
		}
		c.set("userId", identity.userId);
		await next();
		forwardAuthCookies(c.res, authHeaders);
		return;
	},
);
