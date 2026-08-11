import { APIError } from "better-auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { requireRole, requireSession } from "./session";

import type { AppContext, Role } from "@/env";

// Header-driven fake session so requireSession/requireRole run for real
// without standing up Better Auth. `x-test-user` present ⇒ signed in.
// Mirrors the real returnHeaders contract: with `returnHeaders: true` the
// session comes wrapped as { headers, response } — requireSession forwards any
// set-cookie in those headers (the once-per-day refresh re-stamp) — and
// without it the session is returned directly (the admin middleware's style).
// `fake.setCookies` / `fake.error` let individual tests drive those paths.
const fake = vi.hoisted(() => ({
	setCookies: [] as string[],
	error: null as unknown,
}));
vi.mock("@/auth", () => ({
	createAuth: () => ({
		api: {
			getSession: async ({
				headers,
				returnHeaders,
			}: {
				headers: Headers;
				returnHeaders?: boolean;
			}) => {
				if (fake.error) throw fake.error;
				const id = headers.get("x-test-user");
				const session = id ? { user: { id } } : null;
				if (!returnHeaders) return session;
				const h = new Headers();
				for (const v of fake.setCookies) h.append("set-cookie", v);
				return { headers: h, response: session };
			},
		},
	}),
}));

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

const ENV = {} as Parameters<Hono<AppContext>["request"]>[2];

/** Stub the membership lookup: `undefined` ⇒ not a member; anything else is
 * returned verbatim as the member row's role — including strings outside the
 * Role enum, which is exactly what a hand-inserted prod row can carry. */
function mockMemberRole(role: string | null | undefined) {
	const fake = {
		query: {
			member: {
				findFirst: async () => (role === undefined ? undefined : { role }),
			},
		},
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
}

function gate(min: Role) {
	const app = new Hono<AppContext>();
	app.get("/gate", requireSession, requireRole(min), (c) =>
		c.json({ ok: true }),
	);
	return app.request(
		"/gate",
		{ headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" } },
		ENV,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	fake.setCookies = [];
	fake.error = null;
});

const REFRESH_COOKIE =
	"better-auth.session_token=refreshed.sig; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax";

function probeApp() {
	const app = new Hono<AppContext>();
	app.get("/gate", requireSession, (c) => c.json({ ok: true }));
	return app;
}

describe("requireSession", () => {
	it("401s an unauthenticated request with a machine-readable code", async () => {
		// No x-test-user header ⇒ the mocked getSession returns null.
		const res = await probeApp().request("/gate", {}, ENV);
		expect(res.status).toBe(401);
		// The 401 body must carry `code` explicitly — every other error surface
		// does, and the dashboard's ApiError branches on `code ?? error` (#195).
		expect(await res.json()).toEqual({
			error: "unauthorized",
			code: "unauthorized",
		});
	});

	it("forwards the session-refresh Set-Cookie from getSession to the client", async () => {
		// Better Auth's once-per-updateAge refresh re-stamps the cookie INSIDE
		// getSession. requireSession is its busiest caller, so if this forwarding
		// ever regresses, the refresh is consumed server-side and every browser
		// cookie hard-expires 7 days after sign-in (the auto-sign-out bug).
		fake.setCookies = [REFRESH_COOKIE];
		const res = await probeApp().request(
			"/gate",
			{ headers: { "x-test-user": "u1" } },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(res.headers.getSetCookie()).toContain(REFRESH_COOKIE);
	});

	it("emits no Set-Cookie when getSession issued none (no refresh due)", async () => {
		const res = await probeApp().request(
			"/gate",
			{ headers: { "x-test-user": "u1" } },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(res.headers.getSetCookie()).toEqual([]);
	});

	it("APPENDS to a route's own Set-Cookie rather than clobbering it", async () => {
		fake.setCookies = [REFRESH_COOKIE];
		const app = new Hono<AppContext>();
		app.get("/gate", requireSession, (c) => {
			c.header("set-cookie", "route-cookie=1; Path=/", { append: true });
			return c.json({ ok: true });
		});
		const res = await app.request(
			"/gate",
			{ headers: { "x-test-user": "u1" } },
			ENV,
		);
		const cookies = res.headers.getSetCookie();
		expect(cookies).toContain("route-cookie=1; Path=/");
		expect(cookies).toContain(REFRESH_COOKIE);
	});

	it("forwards getSession's dead-cookie clearing on the 401 path", async () => {
		// A cookie whose session row is gone gets cleared by getSession; the
		// clearing must reach the browser so the dead token is dropped.
		fake.setCookies = [
			"better-auth.session_token=; Max-Age=0; Path=/; HttpOnly",
		];
		const res = await probeApp().request("/gate", {}, ENV);
		expect(res.status).toBe(401);
		expect(res.headers.getSetCookie()).toEqual(fake.setCookies);
	});

	it("maps getSession's concurrent-revocation APIError to a plain 401, not a 500", async () => {
		// getSession THROWS (UNAUTHORIZED) when its refresh races a session
		// revocation — an unauthenticated outcome, not a server fault.
		fake.error = new APIError("UNAUTHORIZED");
		const res = await probeApp().request(
			"/gate",
			{ headers: { "x-test-user": "u1" } },
			ENV,
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: "unauthorized",
			code: "unauthorized",
		});
	});

	it("rethrows non-auth getSession failures (a DB outage must stay a 500)", async () => {
		fake.error = new Error("db down");
		const res = await probeApp().request(
			"/gate",
			{ headers: { "x-test-user": "u1" } },
			ENV,
		);
		expect(res.status).toBe(500);
	});
});

describe("requireRole — hierarchy sanity", () => {
	it("admits a role at the gate's rank and above", async () => {
		mockMemberRole("admin");
		expect((await gate("admin")).status).toBe(200);
		mockMemberRole("owner");
		expect((await gate("admin")).status).toBe(200);
	});

	it("denies a role below the gate's rank", async () => {
		mockMemberRole("agent");
		const res = await gate("admin");
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "insufficient_role" });
	});

	it("denies a non-member", async () => {
		mockMemberRole(undefined);
		expect((await gate("agent")).status).toBe(403);
	});

	it("coerces a legacy null role to agent — least privilege, not a crash", async () => {
		mockMemberRole(null);
		expect((await gate("agent")).status).toBe(200);
		mockMemberRole(null);
		expect((await gate("admin")).status).toBe(403);
	});
});

describe("requireRole — malformed role strings (hand-inserted rows)", () => {
	// Prod member rows exist that no app code inserted; nothing constrains their
	// role column to the enum. An out-of-enum string has no ROLE_RANK entry, and
	// `undefined < n` is false — without the ?? 0 coercion every gate, including
	// owner-only billing, silently ADMITS such a row. Deny-by-default means an
	// unknown role is denied by every ranked gate.
	const malformed = ["Owner", "ADMIN", "superuser", ""];

	for (const bad of malformed) {
		it(`denies role ${JSON.stringify(bad)} at every gate`, async () => {
			for (const min of ["agent", "admin", "owner"] as const) {
				mockMemberRole(bad);
				const res = await gate(min);
				expect(res.status).toBe(403);
				expect(await res.json()).toMatchObject({
					code: "insufficient_role",
				});
			}
		});
	}
});
