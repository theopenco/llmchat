import { describe, expect, it } from "vitest";

import {
	breadcrumbLd,
	buildSitemap,
	faqPageLd,
	howToLd,
	pageMeta,
} from "./seo";

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
	useCases: [{ slug: "ecommerce" }, { slug: "documentation" }],
};

describe("buildSitemap", () => {
	const entries = buildSitemap(BASE, input, NOW);
	const urls = entries.map((e) => e.url);

	it("includes the core static routes as absolute URLs", () => {
		expect(urls).toEqual(
			expect.arrayContaining([
				`${BASE}/`,
				`${BASE}/pricing`,
				`${BASE}/compare`,
				`${BASE}/docs`,
				`${BASE}/blog`,
				`${BASE}/privacy-policy`,
				`${BASE}/terms-of-use`,
			]),
		);
	});

	it("enumerates every dynamic blog / vs / migration / feature / use-case page", () => {
		expect(urls).toContain(`${BASE}/blog/introducing-llmchat`);
		expect(urls).toContain(`${BASE}/vs/intercom`);
		expect(urls).toContain(`${BASE}/vs/fin`);
		expect(urls).toContain(`${BASE}/docs/migrate/intercom`);
		expect(urls).toContain(`${BASE}/features/drop-in-widget`);
		expect(urls).toContain(`${BASE}/features/email-threading`);
		expect(urls).toContain(`${BASE}/use-cases`);
		expect(urls).toContain(`${BASE}/use-cases/ecommerce`);
		expect(urls).toContain(`${BASE}/use-cases/documentation`);
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

	it("counts = 8 static + posts + competitors + migrations + features + use cases", () => {
		expect(entries).toHaveLength(8 + 2 + 2 + 1 + 2 + 2);
	});
});

describe("faqPageLd", () => {
	it("builds a FAQPage with a Question/Answer per entry", () => {
		const ld = faqPageLd([
			{ question: "Is it self-hostable?", answer: "Yes." },
			{ question: "Which models?", answer: "Any via LLM Gateway." },
		]);
		expect(ld["@type"]).toBe("FAQPage");
		expect(ld.mainEntity).toEqual([
			{
				"@type": "Question",
				name: "Is it self-hostable?",
				acceptedAnswer: { "@type": "Answer", text: "Yes." },
			},
			{
				"@type": "Question",
				name: "Which models?",
				acceptedAnswer: { "@type": "Answer", text: "Any via LLM Gateway." },
			},
		]);
	});
});

describe("breadcrumbLd", () => {
	it("numbers positions from 1 and absolutises paths", () => {
		const ld = breadcrumbLd(BASE, [
			{ name: "Compare", path: "/compare" },
			{ name: "Intercom", path: "/vs/intercom" },
		]);
		expect(ld["@type"]).toBe("BreadcrumbList");
		expect(ld.itemListElement).toEqual([
			{
				"@type": "ListItem",
				position: 1,
				name: "Compare",
				item: `${BASE}/compare`,
			},
			{
				"@type": "ListItem",
				position: 2,
				name: "Intercom",
				item: `${BASE}/vs/intercom`,
			},
		]);
	});
});

describe("howToLd", () => {
	it("builds a HowTo with positioned steps", () => {
		const ld = howToLd({
			name: "Install",
			description: "Add the widget.",
			steps: [
				{ name: "Create a project", text: "Grab your public key." },
				{ name: "Paste the snippet", text: "Drop the script tag." },
			],
		});
		expect(ld["@type"]).toBe("HowTo");
		expect(ld.step).toEqual([
			{
				"@type": "HowToStep",
				position: 1,
				name: "Create a project",
				text: "Grab your public key.",
			},
			{
				"@type": "HowToStep",
				position: 2,
				name: "Paste the snippet",
				text: "Drop the script tag.",
			},
		]);
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
