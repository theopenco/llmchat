import {
	defineCollection,
	defineConfig,
	defineSingleton,
} from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { z } from "zod";

// ── Blog ──────────────────────────────────────────────────────────────────────
const posts = defineCollection({
	name: "posts",
	directory: "content/blog",
	include: "*.md",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		/** Optional ≤160-char meta description when `description` (the visible
		 * standfirst) runs long — SERPs truncate past ~160 characters. */
		seoDescription: z.string().optional(),
		date: z.string(),
		/** Optional ISO date the post was last revised — drives the visible
		 * "Last updated" line and BlogPosting.dateModified (freshness signal). */
		updated: z.string().optional(),
		/** Optional named author. Falls back to the team byline + Organization
		 * author in schema when unset. */
		author: z.string().optional(),
		/** Optional root-relative cover image (e.g. "/blog/foo.jpg") — rendered
		 * as the article hero and used as the OG/Twitter card image. */
		cover: z.string().optional(),
		/** Alt text for the cover; required for a11y whenever `cover` is set. */
		coverAlt: z.string().optional(),
		category: z.enum(["Announcements", "Guides", "Engineering", "Changelog"]),
		featured: z.boolean().default(false),
	}),
	transform: async (doc, ctx) => {
		const html = await compileMarkdown(ctx, doc);
		const words = doc.content.trim().split(/\s+/).length;
		return {
			...doc,
			slug: doc._meta.path,
			html,
			readingTime: Math.max(1, Math.round(words / 200)),
		};
	},
});

// ── Comparison: per-competitor profiles ───────────────────────────────────────
const vsRow = z.object({
	label: z.string(),
	llmchat: z.string(),
	competitor: z.string(),
});

const competitors = defineCollection({
	name: "competitors",
	directory: "content/competitors",
	include: "*.json",
	parser: "json",
	schema: z.object({
		rank: z.number(),
		id: z.string(),
		name: z.string(),
		url: z.string(),
		tagline: z.string(),
		description: z.string(),
		bestFor: z.string(),
		notFor: z.string(),
		pricing: z.string(),
		heroSubtext: z.string(),
		heroBadges: z.array(z.string()),
		tableSummary: z.object({ llmchat: z.string(), competitor: z.string() }),
		vsCategories: z.array(
			z.object({ heading: z.string(), rows: z.array(vsRow) }),
		),
		tldr: z.string(),
		/** ≤160-char meta description — the `tldr` is page copy and runs 300+
		 * chars, which SERPs truncate or rewrite. */
		seoDescription: z.string(),
		llmchatWins: z.array(z.string()),
		competitorWins: z.array(z.string()),
		llmchatBestFor: z.array(z.string()),
		competitorBestFor: z.array(z.string()),
		keyDifferences: z.array(
			z.object({
				heading: z.string(),
				llmchat: z.string(),
				competitor: z.string(),
				bottomLine: z.string(),
			}),
		),
		migrationNote: z.string(),
		faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
	}),
});

// ── Comparison: migration guides ──────────────────────────────────────────────
const migrations = defineCollection({
	name: "migrations",
	directory: "content/migrations",
	include: "*.json",
	parser: "json",
	schema: z.object({
		rank: z.number(),
		slug: z.string(),
		name: z.string(),
		tagline: z.string(),
		estimatedTime: z.string(),
		intro: z.string(),
		/** ≤160-char meta description — the `intro` is page copy and runs 260+
		 * chars, which SERPs truncate or rewrite. */
		seoDescription: z.string(),
		quickSummary: z.string(),
		oldEmbed: z.string(),
		oldEmbedLabel: z.string(),
		steps: z.array(
			z.object({
				title: z.string(),
				body: z.string(),
				code: z.string().optional(),
				codeLabel: z.string().optional(),
			}),
		),
		mapping: z.array(
			z.object({
				from: z.string(),
				to: z.string(),
				note: z.string().optional(),
			}),
		),
		transfers: z.array(z.string()),
		doesntTransfer: z.array(z.string()),
	}),
});

// ── Comparison: the shared feature matrix (single document) ───────────────────
const rating = z.string();
const matrix = defineSingleton({
	name: "matrix",
	filePath: "content/comparison/matrix.json",
	parser: "json",
	schema: z.object({
		colOrder: z.array(z.string()),
		colLabels: z.record(z.string(), z.string()),
		llmchatEmbed: z.string(),
		featureGroups: z.array(
			z.object({
				heading: z.string(),
				rows: z.array(
					z.object({
						label: z.string(),
						note: z.string().optional(),
						llmchat: rating,
						chatbase: rating,
						fin: rating,
						intercom: rating,
						chatwoot: rating,
						crisp: rating,
					}),
				),
			}),
		),
	}),
});

export default defineConfig({
	content: [posts, competitors, migrations, matrix],
});
