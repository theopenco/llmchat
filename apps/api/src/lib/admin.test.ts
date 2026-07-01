import { describe, expect, it } from "vitest";

import { adminEmails, adminUrl } from "./admin";

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
