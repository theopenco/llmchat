import { describe, expect, it } from "vitest";

import { buildSitemap, pageMeta } from "./seo";

const NOW = new Date("2026-06-20T00:00:00.000Z");
const BASE = "https://clankersupport.com";

const input = {
	posts: [
		{ slug: "introducing-llmchat", date: "2026-05-01" },
		{ slug: "setting-up-email-threading", date: "2026-05-10" },
	],
	competitors: [{ id: "intercom" }, { id: "fin" }],
	migrations: [{ slug: "intercom" }],
	features: [{ slug: "drop-in-widget" }, { slug: "email-threading" }],
};

describe("buildSitemap", () => {
	const entries = buildSitemap(BASE, input, NOW);
	const urls = entries.map((e) => e.url);

	it("includes the core static routes as absolute URLs", () => {
		expect(urls).toEqual(
			expect.arrayContaining([
				`${BASE}/`,
				`${BASE}/compare`,
				`${BASE}/docs`,
				`${BASE}/blog`,
				`${BASE}/privacy-policy`,
				`${BASE}/terms-of-use`,
			]),
		);
	});

	it("enumerates every dynamic blog / vs / migration / feature page", () => {
		expect(urls).toContain(`${BASE}/blog/introducing-llmchat`);
		expect(urls).toContain(`${BASE}/vs/intercom`);
		expect(urls).toContain(`${BASE}/vs/fin`);
		expect(urls).toContain(`${BASE}/docs/migrate/intercom`);
		expect(urls).toContain(`${BASE}/features/drop-in-widget`);
		expect(urls).toContain(`${BASE}/features/email-threading`);
	});

	it("has no relative or double-slashed URLs and no duplicates", () => {
		for (const u of urls) {
			expect(u.startsWith("https://")).toBe(true);
			expect(u.slice("https://".length)).not.toContain("//");
		}
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("dates blog entries from their post date", () => {
		const post = entries.find(
			(e) => e.url === `${BASE}/blog/introducing-llmchat`,
		);
		expect(post?.lastModified).toEqual(new Date("2026-05-01"));
	});

	it("counts = 6 static + posts + competitors + migrations + features", () => {
		expect(entries).toHaveLength(6 + 2 + 2 + 1 + 2);
	});
});

describe("pageMeta", () => {
	it("sets a self-referencing canonical and an OG/Twitter block", () => {
		const m = pageMeta({
			title: "Docs — Clanker Support",
			description: "Get started.",
			path: "/docs",
		});
		expect(m.alternates?.canonical).toBe("/docs");
		expect(m.openGraph?.url).toBe("/docs");
		expect(m.openGraph).toMatchObject({
			type: "website",
			title: "Docs — Clanker Support",
		});
		// @ts-expect-error twitter card shape is a union; assert the field directly
		expect(m.twitter?.card).toBe("summary_large_image");
	});

	it("marks blog posts as articles with a published time", () => {
		const m = pageMeta({
			title: "Post",
			description: "d",
			path: "/blog/x",
			type: "article",
			publishedTime: "2026-05-01",
		});
		expect(m.openGraph).toMatchObject({
			type: "article",
			publishedTime: "2026-05-01",
		});
	});
});
