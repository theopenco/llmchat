import { describe, expect, it } from "vitest";

import { deriveStatus } from "./status";

describe("deriveStatus", () => {
	it("is Open when neither archived nor escalated", () => {
		expect(deriveStatus({ archivedAt: null, escalatedAt: null })).toBe("open");
	});

	it("is Escalated when escalated but not resolved", () => {
		expect(deriveStatus({ archivedAt: null, escalatedAt: "t" })).toBe(
			"escalated",
		);
	});

	it("is Resolved when archived", () => {
		expect(deriveStatus({ archivedAt: "t", escalatedAt: null })).toBe(
			"resolved",
		);
	});

	it("prioritizes Resolved over Escalated (archiving is the terminal state)", () => {
		// A conversation can be both escalated and later resolved — Resolved wins.
		expect(deriveStatus({ archivedAt: "t", escalatedAt: "t" })).toBe(
			"resolved",
		);
	});
});
