import type { Metadata, MetadataRoute } from "next";

import { X_HANDLE } from "./site-urls";

/**
 * Per-page metadata with the SEO essentials wired consistently: a self-
 * referencing canonical, Open Graph, and a Twitter card. `path` is root-
 * relative ("/blog") — metadataBase (set in the root layout) resolves it to an
 * absolute URL. One helper so no page forgets the canonical or the OG block.
 */
/** The site-wide OG cover (the app/opengraph-image.png file convention route).
 * Explicit fallback because a page-level `openGraph` object replaces the
 * layout's resolved metadata wholesale (Next merges shallowly) — without this,
 * every pageMeta page shipped no og:image/twitter:image at all. */
const DEFAULT_OG_IMAGE = "/opengraph-image.png";

export function pageMeta(opts: {
	title: string;
	description: string;
	/** Root-relative path, e.g. "/compare". */
	path: string;
	/** OG type — "article" for blog posts, else "website". */
	type?: "website" | "article";
	/** ISO date for article OG (blog posts). */
	publishedTime?: string;
	/** Root-relative OG/Twitter card image (e.g. "/blog/foo.jpg") —
	 * metadataBase resolves it to an absolute URL. Defaults to the site-wide
	 * OG cover. */
	image?: string;
}): Metadata {
	const {
		title,
		description,
		path,
		type = "website",
		publishedTime,
		image = DEFAULT_OG_IMAGE,
	} = opts;
	return {
		title,
		description,
		// `types` re-declares the RSS alternate: Next replaces the layout's
		// `alternates` object per page rather than merging it, so without this
		// the feed <link> would only render on the home page.
		alternates: {
			canonical: path,
			types: { "application/rss+xml": "/feed.xml" },
		},
		openGraph: {
			type,
			url: path,
			title,
			description,
			siteName: "Clanker Support",
			...(publishedTime ? { publishedTime } : {}),
			images: [{ url: image }],
		},
		twitter: {
			card: "summary_large_image",
			site: X_HANDLE,
			title,
			description,
			images: [image],
		},
	};
}

/**
 * A single FAQ entry. Question/answer pairs feed both the visible FAQ section
 * and the `FAQPage` JSON-LD — answer engines (AI Overviews, Perplexity) extract
 * these directly, so keep answers self-contained and ~40–60 words.
 */
export interface Faq {
	question: string;
	answer: string;
}

/**
 * schema.org `FAQPage`. Render via <JsonLd> alongside a visible FAQ section —
 * Google requires the marked-up Q&As to also be on the page. Returns null when
 * there are no FAQs so callers can `faqs.length ? faqPageLd(faqs) : null`.
 */
export function faqPageLd(faqs: Faq[]): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((f) => ({
			"@type": "Question",
			name: f.question,
			acceptedAnswer: { "@type": "Answer", text: f.answer },
		})),
	};
}

/**
 * schema.org `BreadcrumbList` from an ordered list of trail items. Paths are
 * root-relative ("/compare"); `base` (the canonical origin) makes them absolute,
 * as Google requires for breadcrumb `item` URLs.
 */
export function breadcrumbLd(
	base: string,
	items: { name: string; path: string }[],
): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: `${base}${item.path}`,
		})),
	};
}

/**
 * schema.org `HowTo` from a sequence of steps. Used on the docs quickstart and
 * the migration guides so AI systems can extract the procedure for
 * "how to …" queries.
 */
export function howToLd(opts: {
	name: string;
	description: string;
	steps: { name: string; text: string }[];
}): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name: opts.name,
		description: opts.description,
		step: opts.steps.map((s, i) => ({
			"@type": "HowToStep",
			position: i + 1,
			name: s.name,
			text: s.text,
		})),
	};
}

/**
 * schema.org `WebApplication` for a free interactive tool page (calculator /
 * generator). `offers` at price 0 is what marks it as free — required for the
 * software-app rich result. Category is `BusinessApplication`: these are
 * support-team utilities, not games or dev tools.
 */
export function webApplicationLd(opts: {
	name: string;
	description: string;
	url: string;
}): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: opts.name,
		description: opts.description,
		url: opts.url,
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
	};
}

/**
 * schema.org `ItemList` of pages — used on hub/index pages (e.g. /tools) so
 * crawlers see the set as a curated collection with stable ordering.
 */
export function itemListLd(
	items: { name: string; url: string }[],
): Record<string, unknown> {
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			url: item.url,
		})),
	};
}

export interface SitemapInput {
	posts: { slug: string; date: string; updated?: string }[];
	competitors: { id: string }[];
	migrations: { slug: string }[];
	features: { slug: string }[];
	useCases: { slug: string }[];
	tools: { slug: string }[];
}

/**
 * Build the full sitemap entry list — static routes plus every dynamic
 * blog/comparison/migration page — as absolute URLs. Pure (data in, entries
 * out) so it's unit-tested without the content-collections build or Next.
 *
 * Only blog entries and the /blog hub carry `lastModified` (from real post
 * dates — `updated` when a post was revised, else the publish date; the hub
 * takes the newest of those). The rest deliberately omit it: the previous
 * build-time stamp claimed every page changed on every deploy, which teaches
 * crawlers to distrust the field.
 */
export function buildSitemap(
	base: string,
	input: SitemapInput,
): MetadataRoute.Sitemap {
	const url = (path: string) => `${base}${path}`;

	// Newest post activity — the /blog hub genuinely changes when a post lands.
	const postDates = input.posts.map((p) =>
		new Date(p.updated ?? p.date).getTime(),
	);
	const newestPost = postDates.length ? Math.max(...postDates) : undefined;

	const staticEntries: MetadataRoute.Sitemap = [
		{
			url: url("/"),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: url("/pricing"),
			changeFrequency: "weekly",
			priority: 0.9,
		},
		{
			url: url("/features"),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: url("/compare"),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: url("/blog"),
			...(newestPost ? { lastModified: new Date(newestPost) } : {}),
			changeFrequency: "daily",
			priority: 0.7,
		},
		{
			url: url("/use-cases"),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: url("/tools"),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: url("/privacy-policy"),
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: url("/terms-of-use"),
			changeFrequency: "yearly",
			priority: 0.3,
		},
	];

	const posts: MetadataRoute.Sitemap = input.posts.map((p) => ({
		url: url(`/blog/${p.slug}`),
		lastModified: new Date(p.updated ?? p.date),
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	const vs: MetadataRoute.Sitemap = input.competitors.map((c) => ({
		url: url(`/vs/${c.id}`),
		changeFrequency: "monthly",
		priority: 0.7,
	}));

	const migrate: MetadataRoute.Sitemap = input.migrations.map((m) => ({
		url: url(`/docs/migrate/${m.slug}`),
		changeFrequency: "monthly",
		priority: 0.6,
	}));

	const features: MetadataRoute.Sitemap = input.features.map((f) => ({
		url: url(`/features/${f.slug}`),
		changeFrequency: "monthly",
		priority: 0.7,
	}));

	const useCases: MetadataRoute.Sitemap = input.useCases.map((u) => ({
		url: url(`/use-cases/${u.slug}`),
		changeFrequency: "monthly",
		priority: 0.7,
	}));

	const tools: MetadataRoute.Sitemap = input.tools.map((t) => ({
		url: url(`/tools/${t.slug}`),
		changeFrequency: "monthly",
		priority: 0.7,
	}));

	return [
		...staticEntries,
		...posts,
		...vs,
		...migrate,
		...features,
		...useCases,
		...tools,
	];
}
