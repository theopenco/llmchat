// Builds the /llms.txt body — the llmstxt.org convention: an H1, a one-line
// blockquote summary, an un-headed details block, then sections of markdown
// links so an AI system can grab a map of the product and its key pages. Pure
// (data in, string out) so it's unit-tested without the content-collections
// build or Next.
//
// This file is load-bearing twice: external answer engines read it, AND our
// own support agent ingests it as a URL knowledge source. Two rules follow:
// every claim must describe shipped, live behavior (never roadmap — no
// unreleased integrations), and after deploying a change an operator must hit
// "Recrawl" on the llms.txt source in the dashboard — URL sources are stored
// snapshots, not live fetches, so the agent stays stale until re-synced.

import { BILLING_TIERS } from "@llmchat/shared";

import {
	CANONICAL_SHOWCASE_URL,
	GITHUB_URL,
	RSC_NPM_URL,
	RSC_PACKAGE,
} from "./site-urls";

export interface LlmsTxtInput {
	posts: { slug: string; title: string; description: string }[];
	competitors: { id: string; name: string; tldr: string }[];
	migrations: { slug: string; name: string; tagline: string }[];
	features: { slug: string; name: string; tagline: string }[];
	useCases: { slug: string; name: string; tagline: string }[];
	tools: { slug: string; name: string; tagline: string }[];
}

// Prices come from the shared entitlement table so this file can never
// advertise a number the product doesn't charge.
const STARTER = BILLING_TIERS.starter.priceUsdMonthly;
const GROWTH = BILLING_TIERS.growth.priceUsdMonthly;
const SCALE = BILLING_TIERS.scale.priceUsdMonthly;
const TWO_MONTHS_FREE = (
	[BILLING_TIERS.starter, BILLING_TIERS.growth, BILLING_TIERS.scale] as const
).every((t) => t.priceUsdAnnual === t.priceUsdMonthly * 10);

const SUMMARY = `An AI-powered support agent for your site — install it with one script tag or one React Server Component (${RSC_PACKAGE} on npm). It answers from your docs and sources, then escalates to your team. Open source (MIT) and self-hostable (bring your own keys); the hosted version has flat monthly plans from $${STARTER}/mo with no per-seat fees.`;

const DETAILS = [
	"Two official ways to install:",
	"",
	"- Script tag: paste one `<script>` before `</body>` — the widget mounts in an isolated shadow DOM, inherits your brand color, and needs no build step.",
	`- React / Next.js SDK: \`npm install ${RSC_PACKAGE}\` (React 19 — Next.js 15+ App Router or any RSC framework), then render one \`<ClankerSupport apiKey="pk_…" />\` Server Component in your root layout; no script tag. Restyle the default UI with its \`.clanker-*\` classes and \`--clanker-*\` CSS variables, or build a fully custom UI with the headless primitives and \`useClankerSupport()\` hook from \`${RSC_PACKAGE}/headless\` — which also ships a client-rendered \`ClankerSupportWidget\` for non-RSC React apps.`,
	"",
	"The agent answers from a per-project knowledge base (page URLs, text snippets, and Q&A pairs) with your own system prompt and per-project model choice. Visitors introduce themselves by name (email optional). When the agent can't help, it escalates: your team is notified by email and optionally Slack, the visitor sees a recap of the handoff right in the chat, and the agent stands down — fully silent once a human replies. Replies from the team inbox appear in the widget and go out by email when the visitor shared an address; email replies from the visitor thread back into the same conversation, and visitors can mark their conversation resolved. Quality is tracked with per-message thumbs up/down ratings plus a 1–5 CSAT score.",
];

export function buildLlmsTxt(siteUrl: string, input: LlmsTxtInput): string {
	const lines: string[] = [
		"# Clanker Support",
		"",
		`> ${SUMMARY}`,
		"",
		...DETAILS,
		"",
		"## Product",
		`- [Overview](${siteUrl}/): What Clanker Support is and how the drop-in agent works.`,
		`- [Docs](${siteUrl}/docs): Quickstart (script tag or React SDK), training on your docs, escalation, and migration.`,
		`- [React / Next.js SDK](${RSC_NPM_URL}): ${RSC_PACKAGE} on npm — the widget as one Server Component in your root layout, with a headless entry for custom UIs.`,
		`- [GitHub](${GITHUB_URL}): The open-source (MIT) codebase — self-host the full stack with your own keys.`,
		`- [Live demo](${CANONICAL_SHOWCASE_URL}): The real widget running on a first-party demo page — try it before installing.`,
		`- [Compare](${siteUrl}/compare): How Clanker Support compares to other AI support tools.`,
		`- [Pricing](${siteUrl}/pricing.md): Machine-readable plans — self-host free; hosted Starter $${STARTER}/mo, Growth $${GROWTH}/mo, Scale $${SCALE}/mo${TWO_MONTHS_FREE ? " (annual = two months free)" : ""}.`,
	];

	if (input.features.length) {
		lines.push("", "## Features");
		for (const f of input.features) {
			lines.push(`- [${f.name}](${siteUrl}/features/${f.slug}): ${f.tagline}`);
		}
	}

	if (input.useCases.length) {
		lines.push("", "## Use cases");
		for (const u of input.useCases) {
			lines.push(
				`- [AI support for ${u.name}](${siteUrl}/use-cases/${u.slug}): ${u.tagline}`,
			);
		}
	}

	if (input.tools.length) {
		lines.push("", "## Free tools");
		for (const t of input.tools) {
			lines.push(`- [${t.name}](${siteUrl}/tools/${t.slug}): ${t.tagline}`);
		}
	}

	if (input.competitors.length) {
		lines.push("", "## Comparisons");
		for (const c of input.competitors) {
			lines.push(
				`- [Clanker Support vs ${c.name}](${siteUrl}/vs/${c.id}): ${c.tldr}`,
			);
		}
	}

	if (input.migrations.length) {
		lines.push("", "## Migration guides");
		for (const m of input.migrations) {
			lines.push(
				`- [Migrate from ${m.name} to Clanker Support](${siteUrl}/docs/migrate/${m.slug}): ${m.tagline}`,
			);
		}
	}

	if (input.posts.length) {
		lines.push("", "## Journal");
		for (const p of input.posts) {
			lines.push(`- [${p.title}](${siteUrl}/blog/${p.slug}): ${p.description}`);
		}
	}

	// "Optional" is the llmstxt.org name for skippable, lower-priority links.
	lines.push(
		"",
		"## Optional",
		`- [Privacy policy](${siteUrl}/privacy-policy): How visitor and customer data is handled.`,
		`- [Terms of use](${siteUrl}/terms-of-use): The terms for the hosted service.`,
	);

	return `${lines.join("\n").trimEnd()}\n`;
}
