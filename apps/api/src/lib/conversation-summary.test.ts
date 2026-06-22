import { describe, expect, it } from "vitest";

import { buildTranscript, summaryIsStale } from "./conversation-summary";

describe("summaryIsStale (the cost-bound trigger)", () => {
	it("not stale below the min-message threshold → snippet fallback", () => {
		expect(
			summaryIsStale({
				messageCount: 1,
				summary: null,
				summaryMessageCount: null,
			}),
		).toBe(false);
	});

	it("stale when never summarized and there's a full exchange", () => {
		expect(
			summaryIsStale({
				messageCount: 2,
				summary: null,
				summaryMessageCount: null,
			}),
		).toBe(true);
	});

	it("fresh when the cached marker matches the current count", () => {
		expect(
			summaryIsStale({ messageCount: 4, summary: "x", summaryMessageCount: 4 }),
		).toBe(false);
	});

	it("NOT stale on a single new message (per-exchange delta, cost-aware)", () => {
		expect(
			summaryIsStale({ messageCount: 5, summary: "x", summaryMessageCount: 4 }),
		).toBe(false);
	});

	it("stale once a full exchange (delta >= 2) has accrued", () => {
		expect(
			summaryIsStale({ messageCount: 6, summary: "x", summaryMessageCount: 4 }),
		).toBe(true);
	});
});

describe("buildTranscript", () => {
	it("labels roles (visitor/agent/system) and drops empty messages", () => {
		const t = buildTranscript([
			{ role: "user", content: "Where is my order?" },
			{ role: "assistant", content: "Let me check." },
			{ role: "admin", content: "It ships Monday." },
			{ role: "system", content: "" },
		]);
		expect(t).toContain("Visitor: Where is my order?");
		expect(t).toContain("Agent: Let me check.");
		expect(t).toContain("Agent: It ships Monday.");
		expect(t).not.toContain("System:");
	});

	it("keeps the opener and truncates the middle when over budget", () => {
		const lines = Array.from({ length: 500 }, (_, i) => ({
			role: "user",
			content: `line ${i} ${"x".repeat(40)}`,
		}));
		lines[0] = { role: "user", content: "OPENER the core intent" };
		const t = buildTranscript(lines);
		expect(t.startsWith("Visitor: OPENER the core intent")).toBe(true);
		expect(t).toContain("…");
		expect(t.length).toBeLessThan(6_500);
	});

	it("returns empty string when there's no usable content", () => {
		expect(buildTranscript([{ role: "user", content: "   " }])).toBe("");
	});
});
