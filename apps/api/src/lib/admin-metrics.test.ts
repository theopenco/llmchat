import { describe, expect, it } from "vitest";

import {
	activeSubscriptions,
	buildDayKeys,
	densifySeries,
	estimateMrrUsd,
	foldUsageByDay,
	foldWorkspaceUsage,
	tallyKinds,
	tallyPlans,
	USAGE_KINDS,
	zeroUsageDay,
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

describe("tallyKinds", () => {
	it("fills every kind and sums duplicates", () => {
		expect(
			tallyKinds([
				{ kind: "chat", n: 40 },
				{ kind: "suggestion", n: 3 },
				{ kind: "chat", n: 2 },
			]),
		).toEqual({ chat: 42, suggestion: 3, voice: 0 });
	});

	it("keeps an unknown kind OUT of every named bucket (never mislabeled as visitor chat)", () => {
		expect(
			tallyKinds([
				{ kind: "chat", n: 5 },
				{ kind: "batch-import", n: 9 },
				{ kind: null, n: 1 },
			]),
		).toEqual({ chat: 5, suggestion: 0, voice: 0 });
	});
});

describe("USAGE_KINDS", () => {
	it("is the schema enum itself, so a new kind can't be missed here", () => {
		// Derived, not mirrored — this pin fails only if the derivation is ever
		// replaced by a hand-written list that drifts from schema.ts.
		expect([...USAGE_KINDS]).toEqual(["chat", "suggestion", "voice"]);
	});
});

describe("foldUsageByDay", () => {
	it("keeps all-kind day totals while splitting each known kind", () => {
		expect(
			foldUsageByDay([
				{ day: "2026-08-01", kind: "chat", responses: 5, cost: 0.5 },
				{ day: "2026-08-01", kind: "suggestion", responses: 2, cost: 0.2 },
				{ day: "2026-08-02", kind: "voice", responses: 1, cost: null },
			]),
		).toEqual({
			"2026-08-01": {
				responses: 7,
				cost: 0.7,
				chat: 5,
				suggestion: 2,
				voice: 0,
			},
			"2026-08-02": {
				responses: 1,
				cost: 0,
				chat: 0,
				suggestion: 0,
				voice: 1,
			},
		});
	});

	it("counts an unknown kind in the day total but in no named bucket", () => {
		expect(
			foldUsageByDay([
				{ day: "2026-08-01", kind: "chat", responses: 3, cost: 0 },
				{ day: "2026-08-01", kind: "batch-import", responses: 9, cost: 0 },
			])["2026-08-01"],
		).toEqual({ responses: 12, cost: 0, chat: 3, suggestion: 0, voice: 0 });
	});

	it("gives each day its OWN counters (no shared zero object)", () => {
		const byDay = foldUsageByDay([
			{ day: "2026-08-01", kind: "chat", responses: 1, cost: 0 },
			{ day: "2026-08-02", kind: "chat", responses: 4, cost: 0 },
		]);
		expect(byDay["2026-08-01"].chat).toBe(1);
		expect(byDay["2026-08-02"].chat).toBe(4);
	});

	it("densifies into a dense series whose filled days don't alias the zero", () => {
		const series = densifySeries(
			["2026-08-01", "2026-08-02"],
			foldUsageByDay([
				{ day: "2026-08-02", kind: "chat", responses: 3, cost: 0 },
			]),
			zeroUsageDay(),
		);
		expect(series.map((p) => p.chat)).toEqual([0, 3]);
		// Mutating one point must not bleed into the other (shared-zero guard).
		series[0].chat += 99;
		expect(series[1].chat).toBe(3);
	});
});

describe("foldWorkspaceUsage", () => {
	it("aggregates per workspace: all-kind totals plus a per-kind split", () => {
		const byWs = foldWorkspaceUsage([
			{ id: "ws1", kind: "chat", n: 10, cost: 1 },
			{ id: "ws1", kind: "suggestion", n: 4, cost: 0.4 },
			{ id: "ws2", kind: "voice", n: 2, cost: null },
		]);
		expect(byWs.get("ws1")).toEqual({
			responses: 14,
			cost: 1.4,
			byKind: { chat: 10, suggestion: 4, voice: 0 },
		});
		expect(byWs.get("ws2")).toEqual({
			responses: 2,
			cost: 0,
			byKind: { chat: 0, suggestion: 0, voice: 2 },
		});
		expect(byWs.get("ws-none")).toBeUndefined();
	});

	it("skips rows with no workspace id rather than bucketing them under ''", () => {
		const byWs = foldWorkspaceUsage([
			{ id: null, kind: "chat", n: 3, cost: 0 },
		]);
		expect(byWs.size).toBe(0);
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
