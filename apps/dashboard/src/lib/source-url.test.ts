import { describe, expect, it } from "vitest";

import {
	formatRelativeTime,
	SOURCE_URL_ERRORS,
	validateSourceUrl,
} from "./source-url";

describe("validateSourceUrl", () => {
	it("accepts http and https URLs", () => {
		expect(validateSourceUrl("https://example.com")).toBeNull();
		expect(validateSourceUrl("http://example.com/docs?q=1")).toBeNull();
	});

	it("trims surrounding whitespace before validating", () => {
		expect(validateSourceUrl("  https://example.com  ")).toBeNull();
	});

	it("flags an empty / whitespace-only value separately", () => {
		expect(validateSourceUrl("")).toBe("empty");
		expect(validateSourceUrl("   ")).toBe("empty");
	});

	it("rejects strings that are not URLs", () => {
		expect(validateSourceUrl("not a url")).toBe("invalid");
		expect(validateSourceUrl("example.com")).toBe("invalid"); // no scheme
	});

	// Security: dangerous schemes must never reach the crawler.
	it.each(["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x"])(
		"rejects the non-http(s) scheme %s",
		(value) => {
			expect(validateSourceUrl(value)).toBe("protocol");
		},
	);

	it("exposes a human message for every non-empty error code", () => {
		expect(SOURCE_URL_ERRORS.invalid).toBeTruthy();
		expect(SOURCE_URL_ERRORS.protocol).toBeTruthy();
	});
});

describe("formatRelativeTime", () => {
	const now = Date.parse("2026-06-10T12:00:00.000Z");
	const ago = (ms: number) => new Date(now - ms).toISOString();

	it("returns 'never' for null or unparseable input", () => {
		expect(formatRelativeTime(null, now)).toBe("never");
		expect(formatRelativeTime("not-a-date", now)).toBe("never");
	});

	it("buckets sub-minute and future timestamps as 'just now'", () => {
		expect(formatRelativeTime(ago(5_000), now)).toBe("just now");
		expect(formatRelativeTime(new Date(now + 10_000).toISOString(), now)).toBe(
			"just now",
		);
	});

	it("formats minutes, hours, and days", () => {
		expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5 min ago");
		expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
		expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe("2d ago");
	});

	it("is exclusive at each boundary (59m59s is still minutes)", () => {
		expect(formatRelativeTime(ago(3_600_000 - 1), now)).toBe("59 min ago");
		expect(formatRelativeTime(ago(86_400_000 - 1), now)).toBe("23h ago");
	});
});
