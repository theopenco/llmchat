// End-to-end proof that auth rate limiting is DURABLE across workerd isolates.
// Better Auth's default limiter is in-memory (per-isolate → useless on workerd);
// we back it with the Ploy state binding via rateLimit.customStorage. This drives
// the REAL Better Auth handler (sign-in/email, built-in cap 3/10s) across TWO
// separately-constructed createAuth(env) instances that share ONE STATE store —
// simulating two isolates — and asserts the 429 carries over. If the bucket lived
// in isolate memory, instance #2 would start fresh and never 429.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "@llmchat/db";

import type { Env } from "@/env";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
import { db } from "@/lib/db";
import { createAuth } from "@/auth";

// ─── real sqlite (via proxy), so sign-in runs against a real (empty) DB ─────────
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
	// Two-callback form so the drizzle `casing` option is honored (single-callback
	// form drops it → camelCase SQL against snake_case columns).
	return drizzle(exec, batch, { schema, casing: "snake_case" });
}

function makeEnv(STATE: unknown): Env {
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
		STATE,
	} as unknown as Env;
}

function signInRequest(ip: string) {
	return new Request("http://localhost:8787/api/auth/sign-in/email", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			// Trusted edge header → getIp resolves a stable per-IP key.
			"cf-connecting-ip": ip,
			// A trusted origin so CSRF protection doesn't mask the rate-limit result.
			origin: "http://localhost:3001",
		},
		body: JSON.stringify({
			email: "nobody@example.com",
			password: "whatever123",
		}),
	});
}

function freshStore() {
	const store = new Map<string, string>();
	const STATE = {
		get: vi.fn(async (k: string) => store.get(k) ?? null),
		set: vi.fn(async (k: string, v: string) => {
			store.set(k, v);
		}),
	};
	return { store, STATE };
}

describe("durable auth rate limiting (cross-isolate)", () => {
	let sqlite: DatabaseSync;
	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
	});

	it("carries the 429 across two createAuth instances sharing one STATE store", async () => {
		const { store, STATE } = freshStore();

		// Two independently-constructed auth runtimes — stand-ins for two isolates —
		// wired to the SAME STATE store.
		const auth1 = createAuth(makeEnv(STATE));
		const auth2 = createAuth(makeEnv(STATE));

		const ip = "203.0.113.7";
		// Built-in sign-in rule caps at 3 / 10s. Spread the 4 across both instances.
		const r1 = await auth1.handler(signInRequest(ip));
		const r2 = await auth1.handler(signInRequest(ip));
		const r3 = await auth2.handler(signInRequest(ip));
		const r4 = await auth2.handler(signInRequest(ip));

		expect(r1.status).not.toBe(429);
		expect(r2.status).not.toBe(429);
		expect(r3.status).not.toBe(429);
		// The 4th — on the OTHER instance — is blocked: the count lived in STATE.
		expect(r4.status).toBe(429);

		// Ground truth: the bucket is in the shared store under our namespace.
		expect([...store.keys()].some((k) => k.startsWith("authrl:"))).toBe(true);
	});

	it("keys per-IP: a different client IP is not blocked by another IP's count", async () => {
		const { STATE } = freshStore();
		const auth = createAuth(makeEnv(STATE));

		await auth.handler(signInRequest("198.51.100.1"));
		await auth.handler(signInRequest("198.51.100.1"));
		await auth.handler(signInRequest("198.51.100.1"));
		const blocked = await auth.handler(signInRequest("198.51.100.1"));
		const otherIp = await auth.handler(signInRequest("198.51.100.2"));

		expect(blocked.status).toBe(429);
		expect(otherIp.status).not.toBe(429);
	});

	it("resets the window: a request after the window elapses is allowed again", async () => {
		// The storage layer holds NO window logic by design — Better Auth owns the
		// reset (shouldRateLimit ignores buckets older than the window, and the
		// post-response hook rewrites count:1). Prove that against OUR storage by
		// ageing the stored bucket past the 10s sign-in window (no real sleep).
		const { store, STATE } = freshStore();
		const auth = createAuth(makeEnv(STATE));
		const ip = "203.0.113.8";

		await auth.handler(signInRequest(ip));
		await auth.handler(signInRequest(ip));
		await auth.handler(signInRequest(ip));
		expect((await auth.handler(signInRequest(ip))).status).toBe(429);

		for (const [k, v] of store) {
			const bucket = JSON.parse(v) as { lastRequest: number };
			bucket.lastRequest = Date.now() - 11_000; // older than the 10s window
			store.set(k, JSON.stringify(bucket));
		}

		// Window elapsed → allowed again (Better Auth resets the count).
		expect((await auth.handler(signInRequest(ip))).status).not.toBe(429);
	});

	it("keeps SESSIONS in D1, never in STATE — the delete-cascade contract", async () => {
		// customStorage (not secondaryStorage) must mean a sign-up's session lands in
		// the D1 `session` table and STATE holds ONLY rate-limit buckets. If a future
		// change relocated sessions to STATE, the FK-based delete cascade would orphan
		// them — this guards exactly that.
		const { store, STATE } = freshStore();
		const auth = createAuth(makeEnv(STATE));

		const res = await auth.handler(
			new Request("http://localhost:8787/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "203.0.113.20",
					origin: "http://localhost:3001",
				},
				body: JSON.stringify({
					email: "fresh@example.com",
					password: "whatever123",
					name: "Fresh",
				}),
			}),
		);
		expect(res.status).toBeLessThan(400);

		const sessions = sqlite
			.prepare("SELECT count(*) AS c FROM session")
			.get() as { c: number };
		expect(sessions.c).toBeGreaterThanOrEqual(1); // session is in D1

		// Everything in STATE is a rate-limit bucket — no session token/data leaked.
		expect([...store.keys()].every((k) => k.startsWith("authrl:"))).toBe(true);
	});

	// NOTE: the prod fail-open when the trusted IP header is absent (getIp → null →
	// Better Auth skips limiting) is NOT e2e-tested here on purpose: Better Auth's
	// getIp falls back to 127.0.0.1 under isTest()/isDevelopment() (get-request-ip.mjs),
	// so a test can't observe the prod null-IP path. It's a documented deploy
	// dependency instead — TRUSTED_CLIENT_IP_HEADER must match what the edge forwards
	// (see apps/api/.env.example), or auth rate limiting is silently skipped in prod.
});
