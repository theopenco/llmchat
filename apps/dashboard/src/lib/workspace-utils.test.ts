import { describe, expect, it } from "vitest";

import { canManage, resolveWorkspaceId } from "./workspace-utils";

const ws = (...ids: string[]) =>
	ids.map((id) => ({
		id,
		name: id,
		plan: "starter" as const,
		role: "owner" as const,
	}));

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
