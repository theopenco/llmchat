import { describe, expect, it } from "vitest";

import { resolveSelectedId } from "./selection";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("resolveSelectedId", () => {
	it("returns null when there is nothing to select", () => {
		expect(resolveSelectedId(null, [])).toBeNull();
		expect(resolveSelectedId("a", [])).toBeNull();
	});

	it("keeps a still-valid selection", () => {
		expect(resolveSelectedId("b", items)).toBe("b");
	});

	it("falls back to the first item when the selection is stale", () => {
		// Regression: the inbox used to keep querying a project from another
		// workspace after switching, showing an empty conversation list.
		expect(resolveSelectedId("deleted-id", items)).toBe("a");
	});

	it("falls back to the first item when nothing was selected", () => {
		expect(resolveSelectedId(null, items)).toBe("a");
	});

	it("does not treat an empty-string selection as valid", () => {
		expect(resolveSelectedId("", items)).toBe("a");
	});
});
