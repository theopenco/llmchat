import { describe, expect, it } from "vitest";

import {
	formatFullDate,
	initials,
	parseDevice,
	pluralize,
	timeAgo,
	toDate,
} from "./format";

describe("pluralize", () => {
	it("uses the singular only for a count of 1", () => {
		expect(pluralize(1, "message")).toBe("1 message");
		expect(pluralize(0, "message")).toBe("0 messages");
		expect(pluralize(3, "message")).toBe("3 messages");
	});

	it("supports irregular plurals", () => {
		expect(pluralize(1, "person", "people")).toBe("1 person");
		expect(pluralize(2, "person", "people")).toBe("2 people");
	});
});

describe("toDate", () => {
	it("parses ISO strings (the API wire format)", () => {
		expect(toDate("2026-06-16T05:00:00.000Z")?.getUTCFullYear()).toBe(2026);
	});

	it("tolerates unix seconds and millis so a format change can't break", () => {
		const ms = Date.UTC(2026, 0, 1);
		expect(toDate(ms)?.getTime()).toBe(ms);
		expect(toDate(Math.floor(ms / 1000))?.getTime()).toBe(ms);
	});

	it("returns null for empty / nullish values", () => {
		expect(toDate(null)).toBeNull();
		expect(toDate(undefined)).toBeNull();
		expect(toDate("")).toBeNull();
	});
});

describe("timeAgo", () => {
	const now = Date.UTC(2026, 5, 16, 12, 0, 0);
	const at = (msAgo: number) => new Date(now - msAgo).toISOString();

	it("buckets recent times into compact labels", () => {
		expect(timeAgo(at(0), now)).toBe("just now");
		expect(timeAgo(at(5 * 60_000), now)).toBe("5m");
		expect(timeAgo(at(3 * 3_600_000), now)).toBe("3h");
		expect(timeAgo(at(2 * 86_400_000), now)).toBe("2d");
	});

	it("returns empty string for a missing timestamp", () => {
		expect(timeAgo(null, now)).toBe("");
	});
});

describe("formatFullDate", () => {
	it("renders a dash when there is no date", () => {
		expect(formatFullDate(null)).toBe("—");
	});

	it("renders a real date for a value", () => {
		expect(formatFullDate("2026-06-16T05:00:00.000Z")).toMatch(/2026/);
	});
});

describe("parseDevice", () => {
	it("maps common user agents to a friendly string", () => {
		expect(
			parseDevice(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
			),
		).toBe("Chrome on macOS");
		expect(
			parseDevice("Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/121"),
		).toBe("Firefox on Windows");
		expect(
			parseDevice(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
			),
		).toBe("Safari on iOS");
	});

	it("returns null when there's no user agent (never fabricates)", () => {
		expect(parseDevice(null)).toBeNull();
		expect(parseDevice("")).toBeNull();
	});
});

describe("initials", () => {
	it("takes up to two initials, uppercased", () => {
		expect(initials("Ada Lovelace")).toBe("AL");
		expect(initials("madonna")).toBe("M");
		expect(initials("  jean   claude  van damme ")).toBe("JC");
	});

	it("falls back to '?' with no name", () => {
		expect(initials(null)).toBe("?");
		expect(initials("   ")).toBe("?");
	});
});
