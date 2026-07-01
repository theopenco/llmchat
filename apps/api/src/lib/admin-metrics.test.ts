import { describe, expect, it } from "vitest";

import {
	activeSubscriptions,
	buildDayKeys,
	densifySeries,
	estimateMrrUsd,
	tallyPlans,
} from "./admin-metrics";

describe("tallyPlans", () => {
	it("fills every plan and sums duplicates", () => {
		expect(
			tallyPlans([
				{ plan: "growth", n: 2 },
				{ plan: "none", n: 5 },
				{ plan: "growth", n: 1 },
			]),
		).toEqual({ none: 5, starter: 0, growth: 3, scale: 0 });
	});

	it("collapses legacy/unknown plan values into `none` (matches planEntitlements)", () => {
		expect(
			tallyPlans([
				{ plan: "free", n: 4 },
				{ plan: "pro", n: 2 },
				{ plan: null, n: 1 },
			]),
		).toEqual({ none: 7, starter: 0, growth: 0, scale: 0 });
	});
});

describe("activeSubscriptions", () => {
	it("counts every paid plan, never the unpaid `none`", () => {
		expect(
			activeSubscriptions({ none: 10, starter: 3, growth: 2, scale: 1 }),
		).toBe(6);
		expect(
			activeSubscriptions({ none: 99, starter: 0, growth: 0, scale: 0 }),
		).toBe(0);
	});
});

describe("estimateMrrUsd", () => {
	it("sums paid-plan monthly list prices (19/89/299), ignoring `none`", () => {
		// 3×19 + 2×89 + 1×299 = 57 + 178 + 299 = 534
		expect(estimateMrrUsd({ none: 100, starter: 3, growth: 2, scale: 1 })).toBe(
			534,
		);
	});

	it("is zero with no paid subscriptions", () => {
		expect(estimateMrrUsd({ none: 42, starter: 0, growth: 0, scale: 0 })).toBe(
			0,
		);
	});
});

describe("buildDayKeys", () => {
	it("returns `days` UTC date keys ending at endMs, oldest first", () => {
		const end = Date.UTC(2026, 0, 15, 12, 30, 0); // 2026-01-15T12:30Z
		expect(buildDayKeys(end, 3)).toEqual([
			"2026-01-13",
			"2026-01-14",
			"2026-01-15",
		]);
	});

	it("crosses month boundaries correctly", () => {
		const end = Date.UTC(2026, 2, 1, 0, 0, 0); // 2026-03-01
		expect(buildDayKeys(end, 2)).toEqual(["2026-02-28", "2026-03-01"]);
	});
});

describe("densifySeries", () => {
	it("fills gaps with the zero value, preserving day order", () => {
		expect(
			densifySeries(
				["2026-01-01", "2026-01-02", "2026-01-03"],
				{ "2026-01-02": { count: 5 } },
				{ count: 0 },
			),
		).toEqual([
			{ date: "2026-01-01", count: 0 },
			{ date: "2026-01-02", count: 5 },
			{ date: "2026-01-03", count: 0 },
		]);
	});

	it("supports multi-field points", () => {
		expect(
			densifySeries(
				["2026-01-01", "2026-01-02"],
				{ "2026-01-01": { responses: 3, cost: 0.5 } },
				{ responses: 0, cost: 0 },
			),
		).toEqual([
			{ date: "2026-01-01", responses: 3, cost: 0.5 },
			{ date: "2026-01-02", responses: 0, cost: 0 },
		]);
	});
});
