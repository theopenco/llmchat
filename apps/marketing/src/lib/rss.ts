// Builds the /feed.xml body — RSS 2.0 with an atom:link self-reference.
// Feeds are a discovery channel twice over: Google uses them to find and
// schedule crawls of new posts faster than sitemap polling alone (several of
// our post URLs sat in "Discovered — currently not indexed"), and AI answer
// engines subscribe to them for fresh content. Pure (data in, string out) so
// it's unit-tested without the content-collections build or Next.

export interface RssPost {
	slug: string;
	title: string;
	description: string;
	/** ISO publish date. */
	date: string;
	category: string;
}

/** Minimal XML text escaping for element content. */
function xml(s: string): string {
	return s
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

export function buildRssFeed(base: string, posts: RssPost[]): string {
	const sorted = posts.toSorted(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	const items = sorted.map((p) => {
		const url = `${base}/blog/${p.slug}`;
		return [
			"<item>",
			`<title>${xml(p.title)}</title>`,
			`<link>${url}</link>`,
			`<guid isPermaLink="true">${url}</guid>`,
			`<pubDate>${new Date(p.date).toUTCString()}</pubDate>`,
			`<category>${xml(p.category)}</category>`,
			`<description>${xml(p.description)}</description>`,
			"</item>",
		].join("\n");
	});

	const lastBuild = sorted.length
		? new Date(sorted[0].date).toUTCString()
		: new Date(0).toUTCString();

	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
		"<channel>",
		"<title>Clanker Support Journal</title>",
		`<link>${base}/blog</link>`,
		"<description>Field notes on AI support: announcements, guides, and engineering from the Clanker Support team.</description>",
		"<language>en-us</language>",
		`<lastBuildDate>${lastBuild}</lastBuildDate>`,
		`<atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>`,
		...items,
		"</channel>",
		"</rss>",
		"",
	].join("\n");
}
