import { describe, expect, it } from "vitest";

import { buildSystem } from "./llm";

describe("buildSystem — source assembly (retrieval)", () => {
	it("includes a promoted Q&A source's content in the assembled prompt", async () => {
		// A qa source as produced by /sources/promote: no url, content is the Q/A blob.
		const prompt = buildSystem("You are a support agent.", "", [
			{
				title: "How do I reset my password?",
				url: "",
				content: "Q: How do I reset my password?\nA: Click reset in Settings.",
			},
		]);
		expect(prompt).toContain("Q: How do I reset my password?");
		expect(prompt).toContain("A: Click reset in Settings.");
		expect(prompt).toContain("# Reference sources");
	});

	it("omits the URL line for url-less (qa/text) sources", async () => {
		const prompt = buildSystem("sys", "", [
			{ title: "Promoted answer", url: "", content: "Q: x\nA: y" },
		]);
		// The source still renders, but no dangling "URL: " line.
		expect(prompt).toContain("Promoted answer");
		expect(prompt).not.toContain("URL:");
	});

	it("still renders the URL line for fetched url sources", async () => {
		const prompt = buildSystem("sys", "", [
			{
				title: "Docs",
				url: "https://acme.com/docs",
				content: "Some docs content.",
			},
		]);
		expect(prompt).toContain("URL: https://acme.com/docs");
		expect(prompt).toContain("Some docs content.");
	});

	it("skips sources with empty content", async () => {
		const prompt = buildSystem("sys", "", [
			{ title: "Empty", url: "", content: "   " },
		]);
		expect(prompt).not.toContain("# Reference sources");
	});
});
