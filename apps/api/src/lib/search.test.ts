import { describe, expect, it } from "vitest";

import { buildSnippet, escapeLike, includesCI } from "./search";

describe("escapeLike", () => {
	it("escapes LIKE wildcards and the escape char so a term matches literally", () => {
		expect(escapeLike("100%")).toBe("100\\%");
		expect(escapeLike("a_b")).toBe("a\\_b");
		expect(escapeLike("c:\\path")).toBe("c:\\\\path");
		expect(escapeLike("plain")).toBe("plain");
	});
});

describe("includesCI", () => {
	it("is case-insensitive", () => {
		expect(includesCI("Ada Lovelace", "lovelace")).toBe(true);
		expect(includesCI("ADA@X.IO", "ada@x")).toBe(true);
		expect(includesCI("nope", "zzz")).toBe(false);
	});
});

describe("buildSnippet", () => {
	it("centers a short window on the first hit with ellipses on clipped ends", () => {
		const content =
			"Thanks for reaching out. Our refund policy is a full 30 days, no questions asked, for any order.";
		const snip = buildSnippet(content, "refund", 12);
		expect(snip).toContain("refund");
		expect(snip.startsWith("…")).toBe(true);
		expect(snip.endsWith("…")).toBe(true);
		// Far shorter than the full message — it's an excerpt, not the whole body.
		expect(snip.length).toBeLessThan(content.length);
	});

	it("collapses newlines/whitespace into a single-line preview", () => {
		const snip = buildSnippet(
			"line one\n\n  line   two refund here",
			"refund",
			40,
		);
		expect(snip).not.toContain("\n");
		expect(snip).not.toContain("  ");
		expect(snip).toContain("refund");
	});

	it("does not prepend an ellipsis when the hit is at the start", () => {
		const snip = buildSnippet("Refund requested by the visitor", "refund", 40);
		expect(snip.startsWith("…")).toBe(false);
		expect(snip).toContain("Refund");
	});

	it("falls back to a head excerpt when the term isn't locatable (wildcard)", () => {
		const long = "x".repeat(300);
		const snip = buildSnippet(long, "%", 20);
		expect(snip.endsWith("…")).toBe(true);
		expect(snip.length).toBeLessThan(long.length);
	});

	it("returns the whole (trimmed) body when it's already short", () => {
		expect(buildSnippet("short and sweet", "sweet", 48)).toBe(
			"short and sweet",
		);
	});
});
