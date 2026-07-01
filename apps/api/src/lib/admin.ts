import { isInternalEmail } from "@llmchat/shared";

import type { Env } from "@/env";

/**
 * Pure platform-admin decision. An UNVERIFIED email is NEVER an admin — this is
 * the load-bearing guard: email/password sign-up is unverified and auto-signs-in,
 * so without it an attacker could register an as-yet-unclaimed `ADMIN_EMAILS`
 * address (or any address later granted role='admin') and self-elevate. Once
 * verified, access is granted by the email allowlist OR a DB role of 'admin'.
 * OAuth accounts arrive verified; the dev seed's admin is pre-verified.
 */
export function isAdminGranted(input: {
	emailVerified: boolean;
	email: string;
	role: string | null | undefined;
	allowlist: readonly string[];
}): boolean {
	if (!input.emailVerified) return false;
	if (isInternalEmail(input.email, input.allowlist)) return true;
	return input.role === "admin";
}

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
