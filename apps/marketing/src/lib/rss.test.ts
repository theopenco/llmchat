import { describe, expect, it } from "vitest";

import { buildRssFeed } from "./rss";

const BASE = "https://clankersupport.com";

const posts = [
	{
		slug: "introducing-llmchat",
		title: "Introducing Clanker Support",
		description: "One script tag & <five> minutes.",
		date: "2026-05-20",
		category: "Announcements",
	},
	{
		slug: "best-ai-support-agents",
		title: "The best AI support agents",
		description: "A comparison.",
		date: "2026-07-07",
		category: "Guides",
	},
];

describe("buildRssFeed", () => {
	const feed = buildRssFeed(BASE, posts);

	it("is RSS 2.0 with a self-referencing atom:link", () => {
		expect(feed).toContain(`<rss version="2.0"`);
		expect(feed).toContain(
			`<atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>`,
		);
		expect(feed).toContain(`<link>${BASE}/blog</link>`);
	});

	it("lists every post newest-first with permalink guids and RFC-822 dates", () => {
		const first = feed.indexOf("best-ai-support-agents");
		const second = feed.indexOf("introducing-llmchat");
		expect(first).toBeGreaterThan(-1);
		expect(second).toBeGreaterThan(first);
		expect(feed).toContain(
			`<guid isPermaLink="true">${BASE}/blog/best-ai-support-agents</guid>`,
		);
		expect(feed).toContain(
			`<pubDate>${new Date("2026-07-07").toUTCString()}</pubDate>`,
		);
	});

	it("stamps lastBuildDate from the newest post", () => {
		expect(feed).toContain(
			`<lastBuildDate>${new Date("2026-07-07").toUTCString()}</lastBuildDate>`,
		);
	});

	it("escapes XML-reserved characters in text content", () => {
		expect(feed).toContain(
			"<description>One script tag &amp; &lt;five&gt; minutes.</description>",
		);
		expect(feed).not.toContain("<five>");
	});

	it("handles an empty post list without throwing", () => {
		const empty = buildRssFeed(BASE, []);
		expect(empty).toContain("<channel>");
		expect(empty).not.toContain("<item>");
	});
});
