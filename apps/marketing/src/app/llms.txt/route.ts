import { allCompetitors, allMigrations, allPosts } from "content-collections";

import { buildLlmsTxt } from "@/lib/llms-txt";
import { TOOLS } from "@/lib/tools";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Static: the content collections are fixed at build time.
export const dynamic = "force-static";

export function GET() {
	const body = buildLlmsTxt(CANONICAL_SITE_URL, {
		posts: allPosts.map((p) => ({
			slug: p.slug,
			title: p.title,
			description: p.description,
		})),
		competitors: allCompetitors.map((c) => ({
			id: c.id,
			name: c.name,
			tldr: c.tldr,
		})),
		migrations: allMigrations.map((m) => ({
			slug: m.slug,
			name: m.name,
			tagline: m.tagline,
		})),
		tools: TOOLS.map((t) => ({
			slug: t.slug,
			name: t.name,
			tagline: t.tagline,
		})),
	});

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
