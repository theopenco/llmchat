import { describe, expect, it } from "vitest";

import {
	fmtCompact,
	fmtDate,
	fmtDayLabel,
	fmtInt,
	fmtUsd,
	fmtUsdPrecise,
} from "./format";

describe("fmtInt", () => {
	it("thousands-separates and coalesces nullish to 0", () => {
		expect(fmtInt(1234567)).toBe("1,234,567");
		expect(fmtInt(0)).toBe("0");
		expect(fmtInt(null)).toBe("0");
		expect(fmtInt(undefined)).toBe("0");
	});
});

describe("fmtCompact", () => {
	it("abbreviates large counts", () => {
		expect(fmtCompact(1500)).toBe("1.5K");
		expect(fmtCompact(2_000_000)).toBe("2M");
	});
});

describe("fmtUsd / fmtUsdPrecise", () => {
	it("renders whole-dollar headlines", () => {
		expect(fmtUsd(534)).toBe("$534");
		expect(fmtUsd(0)).toBe("$0");
	});

	it("scales precision: sub-dollar costs get 4 decimals, else 2", () => {
		expect(fmtUsdPrecise(0.0025)).toBe("$0.0025");
		expect(fmtUsdPrecise(12.5)).toBe("$12.50");
		expect(fmtUsdPrecise(0)).toBe("$0.00");
	});
});

describe("date formatters", () => {
	it("labels a YYYY-MM-DD series key as UTC month/day (no drift)", () => {
		expect(fmtDayLabel("2026-01-05")).toBe("Jan 5");
	});

	it("renders an em dash for missing/invalid dates", () => {
		expect(fmtDate(null)).toBe("—");
		expect(fmtDate("not-a-date")).toBe("—");
	});
});
