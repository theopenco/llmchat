import { DOCS_URL } from "@/lib/site";
import { source } from "@/lib/source";

import type { MetadataRoute } from "next";

// Every docs page, as absolute URLs on the docs host. No `lastModified`:
// fumadocs-mdx isn't configured with git timestamps here, and a build-time
// stamp would claim every page changed on every deploy (see the marketing
// sitemap for the same reasoning).
export default function sitemap(): MetadataRoute.Sitemap {
	return source.getPages().map((page) => ({
		url: `${DOCS_URL}${page.url}`,
		changeFrequency: "weekly" as const,
		priority: page.url === "/" ? 1 : 0.7,
	}));
}
