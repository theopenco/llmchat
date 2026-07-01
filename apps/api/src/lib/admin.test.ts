import { describe, expect, it } from "vitest";

import { adminEmails, adminUrl, isAdminGranted } from "./admin";

import type { Env } from "@/env";

/** Minimal Env stub — these helpers only read `env.vars`. */
function env(vars: Record<string, string | undefined>): Env {
	return { vars } as unknown as Env;
}

describe("adminEmails", () => {
	it("splits, trims, and drops empties", () => {
		expect(
			adminEmails(env({ ADMIN_EMAILS: " a@b.com , c@d.com ,, " })),
		).toEqual(["a@b.com", "c@d.com"]);
	});

	it("is empty when unset (nobody is admin via env by default)", () => {
		expect(adminEmails(env({}))).toEqual([]);
		expect(adminEmails(env({ ADMIN_EMAILS: "" }))).toEqual([]);
	});
});

describe("adminUrl", () => {
	it("returns the configured origin", () => {
		expect(
			adminUrl(env({ ADMIN_URL: "https://admin.clankersupport.com" })),
		).toBe("https://admin.clankersupport.com");
	});

	it("defaults to the local dev port when unset", () => {
		expect(adminUrl(env({}))).toBe("http://localhost:3004");
	});
});

describe("isAdminGranted", () => {
	const allow = ["ops@clanker.com"];

	it("NEVER grants admin to an unverified email — even on the allowlist or with role='admin'", () => {
		expect(
			isAdminGranted({
				emailVerified: false,
				email: "ops@clanker.com",
				role: "admin",
				allowlist: allow,
			}),
		).toBe(false);
	});

	it("grants a verified email on the allowlist (case-insensitive)", () => {
		expect(
			isAdminGranted({
				emailVerified: true,
				email: "OPS@CLANKER.COM",
				role: null,
				allowlist: allow,
			}),
		).toBe(true);
	});

	it("grants a verified email with DB role='admin'", () => {
		expect(
			isAdminGranted({
				emailVerified: true,
				email: "someone@else.com",
				role: "admin",
				allowlist: allow,
			}),
		).toBe(true);
	});

	it("denies a verified non-admin, non-allowlisted email", () => {
		expect(
			isAdminGranted({
				emailVerified: true,
				email: "user@customer.com",
				role: "user",
				allowlist: allow,
			}),
		).toBe(false);
		expect(
			isAdminGranted({
				emailVerified: true,
				email: "user@customer.com",
				role: null,
				allowlist: [],
			}),
		).toBe(false);
	});
});
