// End-to-end proof of the email-verification gate (PR2b) against the REAL Better
// Auth handler + a real sqlite DB. Only @/lib/db (proxy) and @/lib/email's
// sendEmail (to capture the link/token) are mocked. Asserts: credential sign-up
// issues NO session and leaves the user unverified; clicking the link verifies +
// creates a session (autoSignInAfterVerification); unverified sign-in is blocked
// 403; the link is built with the fixed dashboard callbackURL. OAuth's
// pass-through is proven separately in auth.linking.e2e.test.ts.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "@llmchat/db";

import type { Env } from "@/env";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
// Keep buildVerificationEmail real; capture sendEmail to read the link + token.
vi.mock("@/lib/email", async (orig) => ({
	...(await orig<typeof import("@/lib/email")>()),
	sendEmail: vi.fn(async () => ({ id: "email_1" })),
}));
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createAuth } from "@/auth";

function applyMigrations(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	const dir = join(process.cwd(), "migrations");
	for (const f of readdirSync(dir)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		sqlite.exec(
			readFileSync(join(dir, f), "utf8")
				.split("--> statement-breakpoint")
				.join("\n"),
		);
	}
}

function makeProxy(sqlite: DatabaseSync) {
	const exec = async (sql: string, params: unknown[], method: string) => {
		const stmt = sqlite.prepare(sql);
		if (method === "run") {
			stmt.run(...(params as never[]));
			return { rows: [] };
		}
		const rows = stmt
			.all(...(params as never[]))
			.map((r) => Object.values(r as object));
		return { rows: method === "get" ? (rows[0] as never) : rows };
	};
	const batch = async (
		queries: { sql: string; params: unknown[]; method: string }[],
	) =>
		queries.map((q) => {
			const stmt = sqlite.prepare(q.sql);
			if (q.method === "run") {
				stmt.run(...(q.params as never[]));
				return { rows: [] };
			}
			const rows = stmt
				.all(...(q.params as never[]))
				.map((o) => Object.values(o as object));
			return { rows: q.method === "get" ? (rows[0] as never) : rows };
		});
	return drizzle(exec, batch, { schema, casing: "snake_case" });
}

function makeEnv(): Env {
	const store = new Map<string, string>();
	return {
		vars: {
			BETTER_AUTH_SECRET: "x".repeat(32),
			BETTER_AUTH_URL: "http://localhost:8787",
			DASHBOARD_URL: "http://localhost:3001",
			MARKETING_URL: "http://localhost:3002",
			SHOWCASE_URL: "http://localhost:3003",
			TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip",
		},
		DB: {},
		STATE: {
			get: vi.fn(async (k: string) => store.get(k) ?? null),
			set: vi.fn(async (k: string, v: string) => {
				store.set(k, v);
			}),
		},
	} as unknown as Env;
}

const PASSWORD = "verify-me-12345";

function signUpRequest(email: string, ip = "203.0.113.30") {
	return new Request("http://localhost:8787/api/auth/sign-up/email", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"cf-connecting-ip": ip,
			origin: "http://localhost:3001",
		},
		body: JSON.stringify({ email, password: PASSWORD, name: "Tester" }),
	});
}

describe("email verification — credential path", () => {
	let sqlite: DatabaseSync;
	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
		vi.mocked(sendEmail).mockClear();
	});

	function userVerified(email: string) {
		return (
			sqlite
				.prepare("SELECT email_verified FROM user WHERE email = ?")
				.get(email) as { email_verified: number } | undefined
		)?.email_verified;
	}
	const sessionCount = () =>
		(sqlite.prepare("SELECT count(*) AS c FROM session").get() as { c: number })
			.c;

	it("sign-up creates an UNVERIFIED user, issues NO session, and sends a verification email", async () => {
		const auth = createAuth(makeEnv());
		const res = await auth.handler(signUpRequest("newuser@example.com"));

		expect(res.status).toBeLessThan(400);
		expect(userVerified("newuser@example.com")).toBe(0);
		expect(sessionCount()).toBe(0); // gated: no auto-session
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe(
			"newuser@example.com",
		);
	});

	it("the verification link uses /api/auth/verify-email + the fixed dashboard callbackURL", async () => {
		const auth = createAuth(makeEnv());
		await auth.handler(signUpRequest("link@example.com"));

		const text = vi.mocked(sendEmail).mock.calls[0]![1].text!;
		expect(text).toContain(
			"http://localhost:8787/api/auth/verify-email?token=",
		);
		expect(text).toContain(
			encodeURIComponent("http://localhost:3001/verify-email"),
		);
	});

	it("clicking the link verifies the email AND creates a session (autoSignInAfterVerification)", async () => {
		const auth = createAuth(makeEnv());
		await auth.handler(signUpRequest("verify@example.com"));

		const token = /token=([^&]+)/.exec(
			vi.mocked(sendEmail).mock.calls[0]![1].text!,
		)![1];
		const callbackURL = encodeURIComponent(
			"http://localhost:3001/verify-email",
		);
		const res = await auth.handler(
			new Request(
				`http://localhost:8787/api/auth/verify-email?token=${token}&callbackURL=${callbackURL}`,
				{ headers: { origin: "http://localhost:3001" } },
			),
		);

		// Success → redirect to the callbackURL with NO error param.
		expect(res.status).toBe(302);
		const location = res.headers.get("location") ?? "";
		expect(location).toContain("localhost:3001/verify-email");
		expect(location).not.toContain("error=");

		expect(userVerified("verify@example.com")).toBe(1);
		expect(sessionCount()).toBeGreaterThanOrEqual(1);
	});

	it("an unverified credential sign-in is blocked with 403", async () => {
		const auth = createAuth(makeEnv());
		await auth.handler(signUpRequest("blocked@example.com"));

		const res = await auth.handler(
			new Request("http://localhost:8787/api/auth/sign-in/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "203.0.113.31",
					origin: "http://localhost:3001",
				},
				body: JSON.stringify({
					email: "blocked@example.com",
					password: PASSWORD,
				}),
			}),
		);

		expect(res.status).toBe(403);
	});
});
