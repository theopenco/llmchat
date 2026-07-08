import { allPosts } from "content-collections";

import { buildRssFeed } from "@/lib/rss";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Static: the content collections are fixed at build time.
export const dynamic = "force-static";

export function GET() {
	const body = buildRssFeed(
		CANONICAL_SITE_URL,
		allPosts.map((p) => ({
			slug: p.slug,
			title: p.title,
			description: p.description,
			date: p.date,
			category: p.category,
		})),
	);

	return new Response(body, {
		headers: {
			"content-type": "application/rss+xml; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
