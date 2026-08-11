// End-to-end proof of the session-refresh cookie chain — the auto-sign-out fix.
//
// Better Auth extends a session once per updateAge (24h) INSIDE getSession and
// emits the re-stamped cookie (fresh Max-Age) with it. requireSession is by far
// the busiest getSession caller (every /api/* request), so it wins that
// once-a-day race almost every time. Before the fix it discarded the emitted
// headers: the DB row was extended but the browser cookie kept the Max-Age
// stamped at sign-in and hard-expired 7 days later — every active user was
// silently signed out weekly. This suite drives the REAL Better Auth runtime
// (sign-up → real session row → real refresh branch) through the REAL
// middleware and asserts the re-stamp reaches the response.

import { DatabaseSync } from "node:sqlite";

import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Env } from "@/env";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
import { db } from "@/lib/db";
import { createAuth } from "@/auth";
import { app } from "@/index";
import { requireSession } from "@/middleware/session";
import { applyMigrations, makeProxy } from "@/test/sqlite-rig";

import type { AppContext } from "@/env";

const DAY = 86_400;
const EXPIRES_IN = 7 * DAY; // Better Auth default session.expiresIn
const UPDATE_AGE = DAY; // Better Auth default session.updateAge

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
			// Lets the signed-up user pass requireGlobalAdmin once email-verified
			// (the admin-middleware forwarding test below).
			ADMIN_EMAILS: "refresh@example.com",
		},
		DB: {},
		STATE: {
			get: async (k: string) => store.get(k) ?? null,
			set: async (k: string, v: string) => {
				store.set(k, v);
			},
		},
	} as unknown as Env;
}

/** Sign up through the REAL auth handler and return the session cookie the
 * browser would hold (plus the raw Set-Cookie it arrived in). */
async function signUp(env: Env) {
	const res = await createAuth(env).handler(
		new Request("http://localhost:8787/api/auth/sign-up/email", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"cf-connecting-ip": "203.0.113.50",
				origin: "http://localhost:3001",
			},
			body: JSON.stringify({
				email: "refresh@example.com",
				password: "whatever123",
				name: "Refresh",
			}),
		}),
	);
	expect(res.status).toBeLessThan(400);
	const setCookie = res.headers
		.getSetCookie()
		.find((c) => c.includes("session_token="));
	expect(setCookie).toBeDefined();
	return { cookie: setCookie!.split(";")[0], setCookie: setCookie! };
}

/** Make the (single) session row `secondsOld` seconds into its life, i.e.
 * expires_at = now + EXPIRES_IN - secondsOld. Refresh is due once
 * secondsOld > UPDATE_AGE. Timestamps are unix SECONDS in the schema. */
function ageSession(sqlite: DatabaseSync, secondsOld: number) {
	const expiresAt = Math.floor(Date.now() / 1000) + EXPIRES_IN - secondsOld;
	sqlite.prepare("UPDATE session SET expires_at = ?").run(expiresAt);
}

function probeApp() {
	return new Hono<AppContext>().get("/api/probe", requireSession, (c) =>
		c.json({ ok: true }),
	);
}

/** Assert a Set-Cookie carries a freshly re-stamped ~7-day Max-Age. Better
 * Auth derives it from the DB-roundtripped expiresAt ((expiresAt - now)/1000),
 * so seconds-truncation legitimately yields 604799 — allow a small skew. */
function expectFreshMaxAge(setCookie: string) {
	const m = /Max-Age=(\d+)/.exec(setCookie);
	expect(m).not.toBeNull();
	const maxAge = Number(m![1]);
	expect(maxAge).toBeGreaterThanOrEqual(EXPIRES_IN - 60);
	expect(maxAge).toBeLessThanOrEqual(EXPIRES_IN);
}

describe("session refresh reaches the browser through requireSession", () => {
	let sqlite: DatabaseSync;
	let env: Env;
	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
		env = makeEnv();
	});

	it("a fresh session gets no re-stamp (refresh not due) — and no no-store stamp either", async () => {
		const { cookie } = await signUp(env);
		const res = await probeApp().request(
			"/api/probe",
			{ headers: { cookie } },
			env,
		);
		expect(res.status).toBe(200);
		expect(res.headers.getSetCookie()).toEqual([]);
		// Ordinary business responses stay cacheable-policy-neutral; only a
		// response that actually carries the session token gets no-store.
		expect(res.headers.get("cache-control")).toBeNull();
	});

	it("once updateAge has passed, a business request re-stamps the cookie with a fresh 7-day Max-Age and extends the DB row", async () => {
		const { cookie } = await signUp(env);
		ageSession(sqlite, UPDATE_AGE + 120); // 1 day + 2 min into the session

		const res = await probeApp().request(
			"/api/probe",
			{ headers: { cookie } },
			env,
		);
		expect(res.status).toBe(200);

		// The re-stamp reached the response — THE fix. Same token, fresh window.
		const reStamp = res.headers
			.getSetCookie()
			.find((c) => c.includes("session_token="));
		expect(reStamp).toBeDefined();
		expectFreshMaxAge(reStamp!);
		expect(reStamp!.split(";")[0]).toBe(cookie);

		// A business response that carries the session token must never be
		// stored by a shared cache (the Ploy edge rewrites cache headers).
		expect(res.headers.get("cache-control")).toBe("no-store");

		// And the DB row was extended to a full window from now.
		const row = sqlite.prepare("SELECT expires_at AS e FROM session").get() as {
			e: number;
		};
		const now = Math.floor(Date.now() / 1000);
		expect(row.e).toBeGreaterThanOrEqual(now + EXPIRES_IN - 60);
	});

	it("the refresh is one-shot: the next request has nothing to forward (and that's fine — the browser already got the re-stamp)", async () => {
		const { cookie } = await signUp(env);
		ageSession(sqlite, UPDATE_AGE + 120);

		const first = await probeApp().request(
			"/api/probe",
			{ headers: { cookie } },
			env,
		);
		expect(first.headers.getSetCookie()).not.toEqual([]);

		const second = await probeApp().request(
			"/api/probe",
			{ headers: { cookie } },
			env,
		);
		expect(second.status).toBe(200);
		expect(second.headers.getSetCookie()).toEqual([]);
	});

	it("the admin middleware forwards the re-stamp too (requireGlobalAdmin + /admin session touches)", async () => {
		const { cookie } = await signUp(env);
		// The signed-up email is on ADMIN_EMAILS; verify it so isAdminGranted
		// passes (unverified email must never be admin).
		sqlite.prepare("UPDATE user SET email_verified = 1").run();
		ageSession(sqlite, UPDATE_AGE + 120);

		const { requireGlobalAdmin } = await import("@/middleware/admin");
		const adminProbe = new Hono<AppContext>().get(
			"/admin/probe",
			requireGlobalAdmin,
			(c) => c.json({ ok: true }),
		);
		const res = await adminProbe.request(
			"/admin/probe",
			{ headers: { cookie } },
			env,
		);
		expect(res.status).toBe(200);
		const reStamp = res.headers
			.getSetCookie()
			.find((c) => c.includes("session_token="));
		expect(reStamp).toBeDefined();
		expectFreshMaxAge(reStamp!);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("a validly-signed cookie whose session row is gone gets a 401 WITH the clearing cookie forwarded", async () => {
		const { cookie } = await signUp(env);
		sqlite.prepare("DELETE FROM session").run();

		const res = await probeApp().request(
			"/api/probe",
			{ headers: { cookie } },
			env,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: "unauthorized",
			code: "unauthorized",
		});
		const clearing = res.headers
			.getSetCookie()
			.find((c) => c.includes("session_token="));
		expect(clearing).toBeDefined();
		expect(clearing).toMatch(/Max-Age=0/);
	});
});

describe("/api/auth/* responses are never cacheable", () => {
	let sqlite: DatabaseSync;
	let env: Env;
	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
		env = makeEnv();
	});

	it("stamps no-store on get-session (1.6.9 sets no cache-control; an edge-cached session envelope replayed across users would be a session-integrity failure)", async () => {
		const res = await app.request(
			"/api/auth/get-session",
			{ headers: { origin: "http://localhost:3001" } },
			env,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("stamps no-store on credentialed auth responses too (sign-up)", async () => {
		const res = await app.request(
			"/api/auth/sign-up/email",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "203.0.113.51",
					origin: "http://localhost:3001",
				},
				body: JSON.stringify({
					email: "nostore@example.com",
					password: "whatever123",
					name: "NoStore",
				}),
			},
			env,
		);
		expect(res.status).toBeLessThan(400);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("the browser's own get-session ALSO re-stamps when it wins the refresh race (the pre-fix lifeline, still intact)", async () => {
		const { cookie } = await signUp(env);
		ageSession(sqlite, UPDATE_AGE + 120);

		const res = await app.request(
			"/api/auth/get-session",
			{ headers: { cookie, origin: "http://localhost:3001" } },
			env,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("cache-control")).toBe("no-store");
		const reStamp = res.headers
			.getSetCookie()
			.find((c) => c.includes("session_token="));
		expect(reStamp).toBeDefined();
		expectFreshMaxAge(reStamp!);
	});
});
