import { describe, expect, it } from "vitest";

import {
	breadcrumbLd,
	buildSitemap,
	faqPageLd,
	howToLd,
	itemListLd,
	pageMeta,
	webApplicationLd,
} from "./seo";

const BASE = "https://clankersupport.com";

const input = {
	posts: [
		{ slug: "introducing-llmchat", date: "2026-05-01" },
		{
			slug: "setting-up-email-threading",
			date: "2026-05-10",
			updated: "2026-06-01",
		},
	],
	competitors: [{ id: "intercom" }, { id: "fin" }],
	migrations: [{ slug: "intercom" }],
	features: [{ slug: "drop-in-widget" }, { slug: "email-threading" }],
	useCases: [{ slug: "ecommerce" }, { slug: "documentation" }],
	tools: [{ slug: "csat-calculator" }, { slug: "llms-txt-generator" }],
};

describe("buildSitemap", () => {
	const entries = buildSitemap(BASE, input);
	const urls = entries.map((e) => e.url);

	it("includes the core static routes as absolute URLs", () => {
		expect(urls).toEqual(
			expect.arrayContaining([
				`${BASE}/`,
				`${BASE}/pricing`,
				`${BASE}/features`,
				`${BASE}/compare`,
				`${BASE}/templates`,
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

	it("includes the tools hub and every tool page", () => {
		expect(urls).toContain(`${BASE}/tools`);
		expect(urls).toContain(`${BASE}/tools/csat-calculator`);
		expect(urls).toContain(`${BASE}/tools/llms-txt-generator`);
	});

	it("has no relative or double-slashed URLs and no duplicates", () => {
		for (const u of urls) {
			expect(u.startsWith("https://")).toBe(true);
			expect(u.slice("https://".length)).not.toContain("//");
		}
		expect(new Set(urls).size).toBe(urls.length);
	});

	it("dates blog entries from their post date, preferring the revision date", () => {
		const post = entries.find(
			(e) => e.url === `${BASE}/blog/introducing-llmchat`,
		);
		expect(post?.lastModified).toEqual(new Date("2026-05-01"));
		const revised = entries.find(
			(e) => e.url === `${BASE}/blog/setting-up-email-threading`,
		);
		expect(revised?.lastModified).toEqual(new Date("2026-06-01"));
	});

	it("dates the /blog hub from the newest post activity", () => {
		const hub = entries.find((e) => e.url === `${BASE}/blog`);
		expect(hub?.lastModified).toEqual(new Date("2026-06-01"));
	});

	it("omits lastModified everywhere else — a build-time stamp would claim every page changed on every deploy", () => {
		for (const e of entries) {
			if (e.url === `${BASE}/blog` || e.url.includes("/blog/")) continue;
			expect(e.lastModified).toBeUndefined();
		}
	});

	it("counts = 10 static + posts + competitors + migrations + features + use cases + tools", () => {
		// /docs is deliberately absent: it 308-redirects to the docs app
		// (next.config.ts) and redirecting URLs don't belong in a sitemap.
		expect(entries).toHaveLength(10 + 2 + 2 + 1 + 2 + 2 + 2);
	});
});

describe("webApplicationLd", () => {
	it("marks the tool as a free web app with an explicit zero-price offer", () => {
		const ld = webApplicationLd({
			name: "CSAT calculator",
			description: "Calculate your CSAT score.",
			url: `${BASE}/tools/csat-calculator`,
		});
		expect(ld["@type"]).toBe("WebApplication");
		expect(ld.applicationCategory).toBe("BusinessApplication");
		expect(ld.offers).toEqual({
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
		});
		expect(ld.url).toBe(`${BASE}/tools/csat-calculator`);
	});
});

describe("itemListLd", () => {
	it("numbers list items from 1 with absolute URLs", () => {
		const ld = itemListLd([
			{ name: "A", url: `${BASE}/tools/a` },
			{ name: "B", url: `${BASE}/tools/b` },
		]);
		expect(ld["@type"]).toBe("ItemList");
		expect(ld.itemListElement).toEqual([
			{ "@type": "ListItem", position: 1, name: "A", url: `${BASE}/tools/a` },
			{ "@type": "ListItem", position: 2, name: "B", url: `${BASE}/tools/b` },
		]);
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
			title: "Pricing — Clanker Support",
			description: "Get started.",
			path: "/pricing",
		});
		expect(m.alternates?.canonical).toBe("/pricing");
		expect(m.openGraph?.url).toBe("/pricing");
		expect(m.openGraph).toMatchObject({
			type: "website",
			title: "Pricing — Clanker Support",
		});
		// @ts-expect-error twitter card shape is a union; assert the field directly
		expect(m.twitter?.card).toBe("summary_large_image");
		// @ts-expect-error twitter card shape is a union; assert the field directly
		expect(m.twitter?.site).toBe("@ClankrSupport");
	});

	it("re-declares the RSS alternate so the feed <link> survives Next's per-page alternates replacement", () => {
		const m = pageMeta({ title: "T", description: "d", path: "/p" });
		expect(m.alternates?.types).toEqual({
			"application/rss+xml": "/feed.xml",
		});
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

	it("threads a cover image into the OG and Twitter cards", () => {
		const m = pageMeta({
			title: "Post",
			description: "d",
			path: "/blog/x",
			type: "article",
			image: "/blog/cover.jpg",
		});
		expect(m.openGraph).toMatchObject({
			images: [{ url: "/blog/cover.jpg" }],
		});
		// @ts-expect-error twitter card shape is a union; assert the field directly
		expect(m.twitter?.images).toEqual(["/blog/cover.jpg"]);
	});

	it("falls back to the site-wide OG cover when no image is set", () => {
		// A page-level openGraph replaces the layout's resolved metadata
		// (shallow merge), so the file-convention og:image never reaches these
		// pages — pageMeta must supply the cover itself or the page ships no
		// card image at all.
		const m = pageMeta({ title: "T", description: "d", path: "/p" });
		expect(m.openGraph).toMatchObject({
			images: [{ url: "/opengraph-image.png" }],
		});
		// @ts-expect-error twitter card shape is a union; assert the field directly
		expect(m.twitter?.images).toEqual(["/opengraph-image.png"]);
	});
});
