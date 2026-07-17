import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt } from "./llms-full-txt";
import { DOCS_URL } from "./site-urls";

const BASE = "https://clankersupport.com";

const input = {
	posts: [
		{
			slug: "older-post",
			title: "Older post",
			description: "The first post.",
			date: "2026-01-05",
			category: "Announcements",
			content: "Body of the older post. See [pricing](/pricing).",
		},
		{
			slug: "newer-post",
			title: "Newer post",
			description: "The second post.",
			date: "2026-03-10",
			updated: "2026-04-01",
			author: "Ada",
			category: "Guides",
			content: "Body of the newer post.",
		},
	],
};

describe("buildLlmsFullTxt", () => {
	const out = buildLlmsFullTxt(BASE, input);

	it("opens with an H1 and a one-line blockquote summary", () => {
		const lines = out.split("\n");
		expect(lines[0]).toBe("# Clanker Support — full blog content");
		expect(lines[2].startsWith("> ")).toBe(true);
	});

	it("points at llms.txt and the docs llms-full.txt", () => {
		expect(out).toContain(`${BASE}/llms.txt`);
		expect(out).toContain(`${DOCS_URL}/llms-full.txt`);
	});

	it("includes every post in full with its absolute URL and dates", () => {
		expect(out).toContain(`URL: ${BASE}/blog/older-post`);
		expect(out).toContain("Body of the older post.");
		expect(out).toContain("Published: 2026-03-10");
		expect(out).toContain("Updated: 2026-04-01");
		expect(out).toContain("Author: Ada");
	});

	it("orders posts newest first", () => {
		expect(out.indexOf("# Newer post")).toBeLessThan(
			out.indexOf("# Older post"),
		);
	});

	it("rewrites root-relative markdown links to absolute site URLs", () => {
		expect(out).toContain(`[pricing](${BASE}/pricing)`);
		expect(out).not.toContain("](/pricing)");
	});

	it("ends with a single trailing newline", () => {
		expect(out.endsWith("\n")).toBe(true);
		expect(out.endsWith("\n\n")).toBe(false);
	});
});
