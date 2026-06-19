import type { Metadata, MetadataRoute } from "next";

/**
 * Per-page metadata with the SEO essentials wired consistently: a self-
 * referencing canonical, Open Graph, and a Twitter card. `path` is root-
 * relative ("/blog") — metadataBase (set in the root layout) resolves it to an
 * absolute URL. One helper so no page forgets the canonical or the OG block.
 */
export function pageMeta(opts: {
	title: string;
	description: string;
	/** Root-relative path, e.g. "/compare". */
	path: string;
	/** OG type — "article" for blog posts, else "website". */
	type?: "website" | "article";
	/** ISO date for article OG (blog posts). */
	publishedTime?: string;
}): Metadata {
	const { title, description, path, type = "website", publishedTime } = opts;
	return {
		title,
		description,
		alternates: { canonical: path },
		openGraph: {
			type,
			url: path,
			title,
			description,
			siteName: "Clanker Support",
			...(publishedTime ? { publishedTime } : {}),
		},
		twitter: { card: "summary_large_image", title, description },
	};
}

export interface SitemapInput {
	posts: { slug: string; date: string }[];
	competitors: { id: string }[];
	migrations: { slug: string }[];
}

/**
 * Build the full sitemap entry list — static routes plus every dynamic
 * blog/comparison/migration page — as absolute URLs. Pure (data in, entries
 * out) so it's unit-tested without the content-collections build or Next.
 */
export function buildSitemap(
	base: string,
	input: SitemapInput,
	now: Date,
): MetadataRoute.Sitemap {
	const url = (path: string) => `${base}${path}`;

	const staticEntries: MetadataRoute.Sitemap = [
		{
			url: url("/"),
			lastModified: now,
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: url("/compare"),
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: url("/docs"),
			lastModified: now,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: url("/blog"),
			lastModified: now,
			changeFrequency: "daily",
			priority: 0.7,
		},
	];

	const posts: MetadataRoute.Sitemap = input.posts.map((p) => ({
		url: url(`/blog/${p.slug}`),
		lastModified: new Date(p.date),
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	const vs: MetadataRoute.Sitemap = input.competitors.map((c) => ({
		url: url(`/vs/${c.id}`),
		lastModified: now,
		changeFrequency: "monthly",
		priority: 0.7,
	}));

	const migrate: MetadataRoute.Sitemap = input.migrations.map((m) => ({
		url: url(`/docs/migrate/${m.slug}`),
		lastModified: now,
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	return [...staticEntries, ...posts, ...vs, ...migrate];
}
