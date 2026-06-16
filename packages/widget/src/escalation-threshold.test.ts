import { describe, expect, it } from "vitest";

import { resolveEscalationThreshold } from "./widget";

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
