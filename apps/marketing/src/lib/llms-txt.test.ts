import { describe, expect, it } from "vitest";

import { buildLlmsTxt } from "./llms-txt";

const BASE = "https://clankersupport.com";

const input = {
	posts: [
		{
			slug: "introducing-llmchat",
			title: "Introducing Clanker Support",
			description: "Why we built it.",
		},
	],
	competitors: [
		{ id: "intercom", name: "Intercom", tldr: "Lighter and cheaper." },
	],
	migrations: [
		{ slug: "intercom", name: "Intercom", tagline: "Move in an afternoon." },
	],
};

describe("buildLlmsTxt", () => {
	const out = buildLlmsTxt(BASE, input);

	it("follows the llms.txt shape: H1, then a one-line blockquote summary", () => {
		const lines = out.split("\n");
		expect(lines[0]).toBe("# Clanker Support");
		expect(lines[2].startsWith("> ")).toBe(true);
	});

	it("links the core product pages with absolute URLs, incl. pricing.md", () => {
		expect(out).toContain(`(${BASE}/)`);
		expect(out).toContain(`(${BASE}/docs)`);
		expect(out).toContain(`(${BASE}/compare)`);
		expect(out).toContain(`(${BASE}/pricing.md)`);
	});

	it("enumerates comparisons, migration guides, and journal posts", () => {
		expect(out).toContain(`[Clanker Support vs Intercom](${BASE}/vs/intercom)`);
		expect(out).toContain(`(${BASE}/docs/migrate/intercom)`);
		expect(out).toContain(`(${BASE}/blog/introducing-llmchat)`);
		expect(out).toContain("## Comparisons");
		expect(out).toContain("## Migration guides");
		expect(out).toContain("## Journal");
	});

	it("uses the 'support agent' positioning, never 'chatbot'", () => {
		expect(out.toLowerCase()).toContain("support agent");
		expect(out.toLowerCase()).not.toContain("chatbot");
	});

	it("ends with a single trailing newline and emits no empty links", () => {
		expect(out.endsWith("\n")).toBe(true);
		expect(out.endsWith("\n\n")).toBe(false);
		expect(out).not.toContain("]()");
	});

	it("omits a section when its collection is empty", () => {
		const out2 = buildLlmsTxt(BASE, { ...input, posts: [] });
		expect(out2).not.toContain("## Journal");
	});
});
