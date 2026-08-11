import { describe, expect, it } from "vitest";

import {
	canManage,
	resolveWorkspaceId,
	shouldDeferDemotion,
	upsertWorkspaceSummary,
} from "./workspace-utils";

import type {
	Plan,
	WorkspacesResponse,
	WorkspaceSummary,
} from "./workspace-utils";

const ws = (...ids: string[]): WorkspaceSummary[] =>
	ids.map((id) => ({
		id,
		name: id,
		plan: "starter" as const,
		role: "owner" as const,
		projectCount: 1,
	}));

const wsItem = (
	id: string,
	opts: { plan?: Plan; projectCount?: number } = {},
): WorkspaceSummary => ({
	id,
	name: id,
	plan: opts.plan ?? "none",
	role: "owner",
	projectCount: opts.projectCount ?? 0,
});

describe("resolveWorkspaceId", () => {
	it("returns null when the user has no workspaces", () => {
		expect(resolveWorkspaceId("anything", [])).toBeNull();
		expect(resolveWorkspaceId(null, [])).toBeNull();
	});

	it("keeps a stored selection that still exists", () => {
		expect(resolveWorkspaceId("b", ws("a", "b", "c"))).toBe("b");
	});

	it("falls back to the first workspace when nothing is stored", () => {
		expect(resolveWorkspaceId(null, ws("a", "b"))).toBe("a");
	});

	// The bug the provider comment warns about: a deleted / foreign id must not
	// pin the UI to a workspace the user can no longer see.
	it("falls back to the first workspace when the stored id is stale", () => {
		expect(resolveWorkspaceId("deleted-id", ws("a", "b"))).toBe("a");
	});

	it("does not treat an empty string as a valid stored id", () => {
		expect(resolveWorkspaceId("", ws("a", "b"))).toBe("a");
	});
});

describe("resolveWorkspaceId — default selection", () => {
	// The reported bug: a member of a non-empty (paid) workspace got stranded on
	// /onboarding because an empty workspace sorted first and the gate only looks
	// at the active workspace.
	it("prefers a non-empty workspace over an empty one that sorts first", () => {
		const list = [
			wsItem("empty", { projectCount: 0 }),
			wsItem("hasProjects", { projectCount: 2 }),
		];
		expect(resolveWorkspaceId(null, list)).toBe("hasProjects");
	});

	it("prefers a paid workspace among the non-empty ones", () => {
		const list = [
			wsItem("freeWithProjects", { plan: "none", projectCount: 1 }),
			wsItem("paidWithProjects", { plan: "growth", projectCount: 1 }),
		];
		expect(resolveWorkspaceId(null, list)).toBe("paidWithProjects");
	});

	it("honors an explicitly-selected empty workspace (never overrides it)", () => {
		const list = [
			wsItem("hasProjects", { projectCount: 3 }),
			wsItem("emptyChosen", { projectCount: 0 }),
		];
		expect(resolveWorkspaceId("emptyChosen", list)).toBe("emptyChosen");
	});

	it("falls back to the first row when every workspace is empty", () => {
		expect(resolveWorkspaceId(null, [wsItem("a"), wsItem("b")])).toBe("a");
	});
});

describe("shouldDeferDemotion", () => {
	// The invite first-run bug: a just-joined workspace id is missing from the
	// stale cached list while the refetch is in flight — demoting there
	// clobbers the selection back to the personal workspace.
	it("defers when the stored id is missing from the list mid-refetch", () => {
		expect(shouldDeferDemotion("joined", ws("personal"), true)).toBe(true);
	});

	it("does NOT defer when nothing is being fetched (genuinely stale id)", () => {
		expect(shouldDeferDemotion("deleted", ws("a", "b"), false)).toBe(false);
	});

	it("does NOT defer when the stored id is in the list (keeping is safe)", () => {
		expect(shouldDeferDemotion("a", ws("a", "b"), true)).toBe(false);
	});

	it("does NOT defer without a stored selection (default pick proceeds)", () => {
		expect(shouldDeferDemotion(null, ws("a"), true)).toBe(false);
		expect(shouldDeferDemotion("", ws("a"), true)).toBe(false);
	});
});

describe("upsertWorkspaceSummary", () => {
	const entry = { id: "joined", name: "Acme", role: "agent" as const };

	it("appends a provisional row when the id is missing", () => {
		const prev: WorkspacesResponse = {
			workspaces: [
				{
					workspace: { id: "personal", name: "Mine", plan: "none" },
					role: "owner",
				},
			],
		};
		const next = upsertWorkspaceSummary(prev, entry);
		expect(next.workspaces.map((r) => r.workspace.id)).toEqual([
			"personal",
			"joined",
		]);
		expect(next.workspaces[1]).toEqual({
			workspace: { id: "joined", name: "Acme", plan: "none" },
			role: "agent",
		});
		// Non-mutating: the cached object is not modified in place.
		expect(prev.workspaces).toHaveLength(1);
	});

	it("creates a single-row list when the cache is empty", () => {
		expect(upsertWorkspaceSummary(undefined, entry).workspaces).toHaveLength(1);
	});

	it("is a no-op (same reference) when the id is already present", () => {
		const prev: WorkspacesResponse = {
			workspaces: [
				{
					workspace: { id: "joined", name: "Acme", plan: "growth" },
					role: "agent",
				},
			],
		};
		expect(upsertWorkspaceSummary(prev, entry)).toBe(prev);
	});
});

describe("canManage", () => {
	it("grants owner and admin", () => {
		expect(canManage("owner")).toBe(true);
		expect(canManage("admin")).toBe(true);
	});

	it("denies agents and unresolved/unknown roles", () => {
		expect(canManage("agent")).toBe(false);
		expect(canManage(null)).toBe(false);
		expect(canManage(undefined)).toBe(false);
	});
});
