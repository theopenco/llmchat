import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import {
	assertDeletable,
	deleteUserRows,
	deleteWorkspaceCascade,
	ownedWorkspaceImpact,
	resolveOwnership,
} from "@/lib/workspace-deletion";

import { account } from "./account";

const dialect = new SQLiteSyncDialect({ casing: "snake_case" });

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

// The deletion service is unit-proven in workspace-deletion.test.ts (real SQL,
// FK-off cascade, sub-gate matrix). Here it's mocked so the ROUTE's orchestration
// — re-auth, email confirm, co-owner/gate aborts, ordering, self-only — is tested
// in isolation.
vi.mock("@/lib/workspace-deletion", () => ({
	resolveOwnership: vi.fn(),
	ownedWorkspaceImpact: vi.fn(),
	assertDeletable: vi.fn(),
	deleteWorkspaceCascade: vi.fn(),
	deleteUserRows: vi.fn(),
}));
vi.mock("better-auth/crypto", () => ({ verifyPassword: vi.fn() }));
import { verifyPassword } from "better-auth/crypto";

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof account.request
>[2];

interface State {
	user?: { name: string; email: string };
	/** account.findFirst result for the credential lookup ({password} or none). */
	credential?: { password: string };
	ownership?: {
		solelyOwned: {
			id: string;
			plan: string;
			stripeSubscriptionId: string | null;
		}[];
		coOwned: string[];
	};
	impact?: Record<string, number>;
	gate?: { blocked: boolean; reason?: string; workspaceId?: string };
	verifyOk?: boolean;
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
			account: { findFirst: async () => state.credential },
		},
		update: updateSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);

	vi.mocked(resolveOwnership).mockResolvedValue(
		state.ownership ?? { solelyOwned: [], coOwned: [] },
	);
	vi.mocked(ownedWorkspaceImpact).mockResolvedValue(
		(state.impact as never) ?? {
			workspaces: 0,
			projects: 0,
			conversations: 0,
			sources: 0,
			members: 0,
		},
	);
	vi.mocked(assertDeletable).mockResolvedValue(
		(state.gate ?? { blocked: false }) as never,
	);
	vi.mocked(deleteWorkspaceCascade).mockResolvedValue([] as never);
	vi.mocked(deleteUserRows).mockResolvedValue([] as never);
	vi.mocked(verifyPassword).mockResolvedValue(state.verifyOk ?? false);
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
function del(body: unknown, headers: Record<string, string> = ME) {
	return account.request(
		"/account",
		{
			method: "DELETE",
			headers: { ...headers, ...json },
			body: JSON.stringify(body),
		},
		ENV,
	);
}

const USER = { name: "Ada", email: "ada@x.io" };

beforeEach(() => vi.clearAllMocks());

describe("GET /account", () => {
	it("401s without a session", async () => {
		mockDb({});
		expect((await get({})).status).toBe(401);
	});

	it("returns profile + hasPassword + impact + blocker hints", async () => {
		mockDb({
			user: USER,
			credential: { password: "HASH" },
			ownership: {
				solelyOwned: [
					{ id: "ws1", plan: "growth", stripeSubscriptionId: "sub_1" },
				],
				coOwned: [],
			},
			impact: {
				workspaces: 1,
				projects: 2,
				conversations: 9,
				sources: 3,
				members: 1,
			},
		});
		const res = await get(ME);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			name: "Ada",
			email: "ada@x.io",
			hasPassword: true,
			impact: {
				workspaces: 1,
				projects: 2,
				conversations: 9,
				sources: 3,
				members: 1,
			},
			blockers: { activeSubscription: true, drift: false, coOwner: false },
		});
	});

	it("hasPassword is false for an OAuth-only user", async () => {
		mockDb({ user: USER, credential: undefined });
		const body = (await (await get(ME)).json()) as { hasPassword: boolean };
		expect(body.hasPassword).toBe(false);
	});
});

describe("PATCH /account (unchanged self-only behavior)", () => {
	it("updates only name, keyed to the session user; ignores a smuggled id", async () => {
		mockDb({ user: USER });
		const res = await patch({ name: "Grace", id: "victim", userId: "victim" });
		expect(res.status).toBe(200);
		expect(Object.keys(lastSet ?? {}).sort()).toEqual(["name", "updatedAt"]);
		const { params } = dialect.sqlToQuery(lastWhere!);
		expect(params).toContain("u1");
		expect(params).not.toContain("victim");
	});

	it("400s an empty/over-length name", async () => {
		mockDb({ user: USER });
		expect((await patch({ name: "   " })).status).toBe(400);
		expect((await patch({ name: "x".repeat(101) })).status).toBe(400);
	});
});

describe("DELETE /account — re-auth + confirm", () => {
	it("401s without a session; deletes nothing", async () => {
		mockDb({ user: USER });
		const res = await del({ confirmEmail: "ada@x.io" }, {});
		expect(res.status).toBe(401);
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("400s when the confirmation email doesn't match (case-insensitive); deletes nothing", async () => {
		mockDb({ user: USER });
		const res = await del({ confirmEmail: "wrong@x.io" });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "email_mismatch" });
		expect(resolveOwnership).not.toHaveBeenCalled();
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("accepts a case-insensitive email match", async () => {
		mockDb({ user: USER, credential: undefined });
		const res = await del({ confirmEmail: "ADA@X.IO" });
		expect(res.status).toBe(200);
	});

	it("403s when a credential user omits the password; deletes nothing", async () => {
		mockDb({ user: USER, credential: { password: "HASH" } });
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: "password_required" });
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("403s a wrong password (verified via better-auth); deletes nothing", async () => {
		mockDb({ user: USER, credential: { password: "HASH" }, verifyOk: false });
		const res = await del({ confirmEmail: "ada@x.io", password: "nope" });
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: "invalid_password" });
		expect(verifyPassword).toHaveBeenCalledWith({
			hash: "HASH",
			password: "nope",
		});
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("proceeds for a credential user with the correct password", async () => {
		mockDb({ user: USER, credential: { password: "HASH" }, verifyOk: true });
		const res = await del({ confirmEmail: "ada@x.io", password: "right" });
		expect(res.status).toBe(200);
		expect(deleteUserRows).toHaveBeenCalledTimes(1);
	});

	it("OAuth-only user deletes with NO password (verify never called)", async () => {
		mockDb({ user: USER, credential: undefined });
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(200);
		expect(verifyPassword).not.toHaveBeenCalled();
		expect(deleteUserRows).toHaveBeenCalledTimes(1);
	});
});

describe("DELETE /account — gates + ordering", () => {
	it("409s co_owner; deletes nothing", async () => {
		mockDb({
			user: USER,
			credential: undefined,
			ownership: { solelyOwned: [], coOwned: ["wsShared"] },
		});
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "co_owner" });
		expect(assertDeletable).not.toHaveBeenCalled();
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("409s an active subscription (gate blocked) BEFORE any delete", async () => {
		mockDb({
			user: USER,
			credential: undefined,
			ownership: {
				solelyOwned: [
					{ id: "ws1", plan: "growth", stripeSubscriptionId: "sub_1" },
				],
				coOwned: [],
			},
			gate: {
				blocked: true,
				reason: "active_subscription",
				workspaceId: "ws1",
			},
		});
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "active_subscription" });
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("409s billing_unverified (fail-closed) BEFORE any delete", async () => {
		mockDb({
			user: USER,
			ownership: {
				solelyOwned: [
					{ id: "ws1", plan: "growth", stripeSubscriptionId: "sub_1" },
				],
				coOwned: [],
			},
			gate: { blocked: true, reason: "billing_unverified" },
		});
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "billing_unverified" });
		expect(deleteUserRows).not.toHaveBeenCalled();
	});

	it("happy path: cascades every owned workspace, then deletes the user LAST (self-from-session)", async () => {
		mockDb({
			user: USER,
			credential: undefined,
			ownership: {
				solelyOwned: [
					{ id: "wsA", plan: "none", stripeSubscriptionId: null },
					{ id: "wsB", plan: "none", stripeSubscriptionId: null },
				],
				coOwned: [],
			},
		});
		// Even with a smuggled id in the body, deletion targets the SESSION user.
		const res = await del({ confirmEmail: "ada@x.io", id: "victim" });
		expect(res.status).toBe(200);
		expect(deleteWorkspaceCascade).toHaveBeenCalledTimes(2);
		expect(deleteUserRows).toHaveBeenCalledTimes(1);
		// user rows are deleted with the SESSION user id + email, never "victim".
		expect(vi.mocked(deleteUserRows).mock.calls[0]![1]).toBe("u1");
		expect(vi.mocked(deleteUserRows).mock.calls[0]![2]).toBe("ada@x.io");
		// Ordering: every workspace cascade runs BEFORE the user delete.
		const userOrder = vi.mocked(deleteUserRows).mock.invocationCallOrder[0]!;
		for (const o of vi.mocked(deleteWorkspaceCascade).mock
			.invocationCallOrder) {
			expect(o).toBeLessThan(userOrder);
		}
	});

	it("idempotent re-run from partial state (no owned workspaces left) still deletes the user, 200", async () => {
		mockDb({
			user: USER,
			credential: undefined,
			ownership: { solelyOwned: [], coOwned: [] },
		});
		const res = await del({ confirmEmail: "ada@x.io" });
		expect(res.status).toBe(200);
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
		expect(deleteUserRows).toHaveBeenCalledTimes(1);
	});
});
