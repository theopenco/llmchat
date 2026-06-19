import type { MetadataRoute } from "next";
import { allCompetitors, allMigrations, allPosts } from "content-collections";

import { buildSitemap } from "@/lib/seo";
import { FEATURES } from "@/lib/features";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

export default function sitemap(): MetadataRoute.Sitemap {
	return buildSitemap(
		CANONICAL_SITE_URL,
		{
			posts: allPosts.map((p) => ({ slug: p.slug, date: p.date })),
			competitors: allCompetitors.map((c) => ({ id: c.id })),
			migrations: allMigrations.map((m) => ({ slug: m.slug })),
			features: FEATURES.map((f) => ({ slug: f.slug })),
		},
		new Date(),
	);
}
