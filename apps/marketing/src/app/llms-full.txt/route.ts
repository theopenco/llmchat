import { allPosts } from "content-collections";

import { buildLlmsFullTxt } from "@/lib/llms-full-txt";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Static: the content collections are fixed at build time.
export const dynamic = "force-static";

export function GET() {
	const body = buildLlmsFullTxt(CANONICAL_SITE_URL, {
		posts: allPosts.map((p) => ({
			slug: p.slug,
			title: p.title,
			description: p.description,
			date: p.date,
			updated: p.updated,
			author: p.author,
			category: p.category,
			content: p.content,
		})),
	});

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
