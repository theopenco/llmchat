import type { Env } from "@/env";

/**
 * The platform-admin email allowlist, parsed from `ADMIN_EMAILS`. Empty when
 * unset — so nobody is an admin via env unless explicitly configured (the DB
 * `user.role = 'admin'` path still applies). Mirrors `internalEmails` in
 * lib/plan.ts. This is the bootstrap grant: a listed operator is an admin even
 * before any row is written, so the first admin needs no manual DB edit.
 */
export function adminEmails(env: Env): string[] {
	const raw = env.vars.ADMIN_EMAILS;
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Canonical origin of the admin dashboard, defaulting to the local dev port. */
export function adminUrl(env: Env): string {
	return env.vars.ADMIN_URL || "http://localhost:3004";
}
