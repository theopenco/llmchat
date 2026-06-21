import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { account } from "./account";

// Render a captured drizzle WHERE to SQL so a test can prove the update is keyed
// to the SESSION user (and never to an id from the request body).
const dialect = new SQLiteSyncDialect({ casing: "snake_case" });

// Header-driven fake session: `x-test-user` present ⇒ that user is signed in.
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

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof account.request
>[2];

interface State {
	/** The row query.user.findFirst resolves (undefined ⇒ 404). */
	user?: { name: string; email: string };
}

let updateSpy: ReturnType<typeof vi.fn>;
let lastSet: Record<string, unknown> | null;
let lastWhere: Parameters<typeof dialect.sqlToQuery>[0] | null;

function mockDb(state: State) {
	lastSet = null;
	lastWhere = null;
	updateSpy = vi.fn(() => ({
		set: (data: Record<string, unknown>) => {
			lastSet = data;
			return {
				where: (cond: Parameters<typeof dialect.sqlToQuery>[0]) => {
					lastWhere = cond;
					return {
						returning: async () => [
							{
								name: (data.name as string) ?? state.user?.name ?? "",
								email: state.user?.email ?? "me@x.io",
							},
						],
					};
				},
			};
		},
	}));
	const fake = {
		query: {
			user: { findFirst: async () => state.user },
		},
		update: updateSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
}

const ME = { "x-test-user": "u1" };
const json = { "content-type": "application/json" };

function get(headers: Record<string, string>) {
	return account.request("/account", { method: "GET", headers }, ENV);
}
function patch(body: unknown, headers: Record<string, string> = ME) {
	return account.request(
		"/account",
		{
			method: "PATCH",
			headers: { ...headers, ...json },
			body: JSON.stringify(body),
		},
		ENV,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /account", () => {
	it("401s without a session", async () => {
		mockDb({});
		expect((await get({})).status).toBe(401);
	});

	it("returns the signed-in user's own profile", async () => {
		mockDb({ user: { name: "Ada Lovelace", email: "ada@x.io" } });
		const res = await get(ME);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			name: "Ada Lovelace",
			email: "ada@x.io",
		});
	});
});

describe("PATCH /account", () => {
	it("401s without a session; never updates", async () => {
		mockDb({});
		const res = await patch({ name: "New" }, {});
		expect(res.status).toBe(401);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("updates the name and returns the profile", async () => {
		mockDb({ user: { name: "Ada", email: "ada@x.io" } });
		const res = await patch({ name: "Grace Hopper" });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			name: "Grace Hopper",
			email: "ada@x.io",
		});
		// Only name (+ updatedAt) is written — no other columns.
		expect(Object.keys(lastSet ?? {}).sort()).toEqual(["name", "updatedAt"]);
		expect(lastSet).toMatchObject({ name: "Grace Hopper" });
	});

	it("400s an empty / whitespace-only name; never updates", async () => {
		mockDb({ user: { name: "Ada", email: "ada@x.io" } });
		expect((await patch({ name: "" })).status).toBe(400);
		expect((await patch({ name: "   " })).status).toBe(400);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("400s an over-length name (>100); never updates", async () => {
		mockDb({ user: { name: "Ada", email: "ada@x.io" } });
		expect((await patch({ name: "x".repeat(101) })).status).toBe(400);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("is self-only: the update is keyed to the SESSION user, and a smuggled id is ignored", async () => {
		mockDb({ user: { name: "Ada", email: "ada@x.io" } });
		// Try to target another user via the body — it must have no effect.
		const res = await patch({
			name: "Renamed",
			id: "victim",
			userId: "victim",
		});
		expect(res.status).toBe(200);
		// The write is scoped to the session user u1, never "victim".
		const { params } = dialect.sqlToQuery(lastWhere!);
		expect(params).toContain("u1");
		expect(params).not.toContain("victim");
		// And the smuggled fields never reached the column set.
		expect(lastSet).not.toHaveProperty("id");
		expect(lastSet).not.toHaveProperty("userId");
	});
});
