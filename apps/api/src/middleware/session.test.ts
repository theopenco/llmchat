import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { requireRole, requireSession } from "./session";

import type { AppContext, Role } from "@/env";

// Header-driven fake session so requireSession/requireRole run for real
// without standing up Better Auth. `x-test-user` present ⇒ signed in.
vi.mock("@/auth", () => ({
	createAuth: () => ({
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-test-user");
				return id ? { user: { id } } : null;
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

beforeEach(() => vi.clearAllMocks());

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
