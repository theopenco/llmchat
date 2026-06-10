import { describe, expect, it } from "vitest";

import { resolveWorkspaceId } from "./workspace-utils";

const ws = (...ids: string[]) => ids.map((id) => ({ id, name: id }));

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
