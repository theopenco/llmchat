import { describe, expect, it } from "vitest";

import { deriveEscalated, resolveEscalationThreshold } from "./widget";

describe("resolveEscalationThreshold", () => {
	it("uses the configured value when it is a valid positive integer", () => {
		expect(resolveEscalationThreshold(1)).toBe(1);
		expect(resolveEscalationThreshold(5)).toBe(5);
	});

	it("floors fractional values", () => {
		expect(resolveEscalationThreshold(2.9)).toBe(2);
	});

	it("falls back to 3 when missing or below 1", () => {
		expect(resolveEscalationThreshold(undefined)).toBe(3);
		expect(resolveEscalationThreshold(0)).toBe(3);
		expect(resolveEscalationThreshold(-4)).toBe(3);
		expect(resolveEscalationThreshold(Number.NaN)).toBe(3);
	});
});

describe("deriveEscalated", () => {
	it("is escalated when escalated this session", () => {
		expect(deriveEscalated(true, null)).toBe(true);
	});

	it("hydrates from the server feed (the reload case → CTA stays hidden)", () => {
		// sessionEscalated=false but the feed reports an escalation — e.g. after a
		// reload, before the visitor re-clicks anything.
		expect(deriveEscalated(false, "2026-06-29T00:00:00.000Z")).toBe(true);
		expect(deriveEscalated(false, 1_751_000_000)).toBe(true);
	});

	it("is NOT escalated when neither session nor feed says so", () => {
		expect(deriveEscalated(false, null)).toBe(false);
	});
});
