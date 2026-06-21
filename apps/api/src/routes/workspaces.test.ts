import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import {
	assertDeletable,
	deleteWorkspaceCascade,
} from "@/lib/workspace-deletion";

import { workspaces } from "./workspaces";

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
// The cascade + sub-gate are proven in workspace-deletion.test.ts; mocked here so
// the ROUTE's guards/orchestration are tested in isolation.
vi.mock("@/lib/workspace-deletion", () => ({
	assertDeletable: vi.fn(),
	deleteWorkspaceCascade: vi.fn(),
}));
vi.mock("@/lib/provisioning", () => ({
	provisionWorkspace: vi.fn(async () => ({ id: "ws_new", name: "New" })),
}));

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof workspaces.request
>[2];

interface State {
	/** member.findFirst owner lookup (undefined ⇒ not owner ⇒ 403). */
	owner?: Record<string, unknown>;
	/** workspace.findFirst (undefined ⇒ 404). */
	workspace?: Record<string, unknown>;
	/** The user's total membership count (last-workspace guard). */
	memberships?: number;
	gate?: { blocked: boolean; reason?: string };
}

function mockDb(state: State) {
	const fake = {
		query: {
			member: { findFirst: async () => state.owner },
			workspace: { findFirst: async () => state.workspace },
		},
		select: () => ({
			from: () => ({ where: async () => [{ n: state.memberships ?? 2 }] }),
		}),
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	vi.mocked(assertDeletable).mockResolvedValue(
		(state.gate ?? { blocked: false }) as never,
	);
	vi.mocked(deleteWorkspaceCascade).mockResolvedValue([] as never);
}

const ME = { "x-test-user": "u1" };
function del(id = "ws1", headers: Record<string, string> = ME) {
	return workspaces.request(
		`/workspaces/${id}`,
		{ method: "DELETE", headers },
		ENV,
	);
}

const OWNER = { id: "m1", role: "owner" };
const WS = { id: "ws1", plan: "none", stripeSubscriptionId: null };

beforeEach(() => vi.clearAllMocks());

describe("DELETE /workspaces/:id", () => {
	it("401s without a session", async () => {
		mockDb({});
		expect((await del("ws1", {})).status).toBe(401);
	});

	it("403s a non-owner; never cascades", async () => {
		mockDb({ owner: undefined, workspace: WS });
		const res = await del();
		expect(res.status).toBe(403);
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
	});

	it("404s a workspace that doesn't exist", async () => {
		mockDb({ owner: OWNER, workspace: undefined });
		expect((await del()).status).toBe(404);
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
	});

	it("409s deleting the user's last workspace; never cascades", async () => {
		mockDb({ owner: OWNER, workspace: WS, memberships: 1 });
		const res = await del();
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "last_workspace" });
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
	});

	it("409s an active subscription (gate blocked) BEFORE any delete", async () => {
		mockDb({
			owner: OWNER,
			workspace: { id: "ws1", plan: "growth", stripeSubscriptionId: "sub_1" },
			memberships: 2,
			gate: { blocked: true, reason: "active_subscription" },
		});
		const res = await del();
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "active_subscription" });
		expect(deleteWorkspaceCascade).not.toHaveBeenCalled();
	});

	it("owner deletes a free, non-last workspace → invokes the cascade with the id", async () => {
		mockDb({ owner: OWNER, workspace: WS, memberships: 2 });
		const res = await del("ws1");
		expect(res.status).toBe(200);
		expect(deleteWorkspaceCascade).toHaveBeenCalledTimes(1);
		// Called with (db, "ws1") — the path id.
		expect(vi.mocked(deleteWorkspaceCascade).mock.calls[0]![1]).toBe("ws1");
	});
});

describe("POST /workspaces (create, existing — sanity)", () => {
	it("provisions a workspace for the session user", async () => {
		mockDb({});
		const res = await workspaces.request(
			"/workspaces",
			{
				method: "POST",
				headers: { ...ME, "content-type": "application/json" },
				body: JSON.stringify({ name: "Acme" }),
			},
			ENV,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ workspace: { id: "ws_new" } });
	});
});
