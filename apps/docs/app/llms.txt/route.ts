import { BILLING_TIERS } from "@llmchat/shared";

import {
	DASHBOARD_URL,
	DOCS_URL,
	GITHUB_URL,
	RSC_NPM_URL,
	RSC_PACKAGE,
	SHOWCASE_URL,
	SITE_URL,
} from "@/lib/site";
import { source } from "@/lib/source";

import type { InferPageType } from "fumadocs-core/source";

// cached forever
export const revalidate = false;

const STARTER = BILLING_TIERS.starter.priceUsdMonthly;
const GROWTH = BILLING_TIERS.growth.priceUsdMonthly;
const SCALE = BILLING_TIERS.scale.priceUsdMonthly;

type Page = InferPageType<typeof source>;

// Section headings keyed by the first URL segment, in the order they should
// appear. Pages whose first segment isn't listed fall back to "Getting started".
const SECTIONS: { key: string; title: string }[] = [
	{ key: "", title: "Getting started" },
	{ key: "features", title: "Features" },
	{ key: "integrations", title: "Integrations" },
	{ key: "learn", title: "Dashboard knowledge base" },
];

function sectionKey(page: Page): string {
	const first = page.url.split("/").filter(Boolean)[0] ?? "";
	return SECTIONS.some((s) => s.key === first) ? first : "";
}

export async function GET() {
	const pages = source.getPages();

	const grouped = new Map<string, string[]>();
	for (const page of pages) {
		const key = sectionKey(page);
		const line = `- [${page.data.title}](${DOCS_URL}${page.url})${page.data.description ? `: ${page.data.description}` : ""}`;
		const existing = grouped.get(key);
		if (existing) {
			existing.push(line);
		} else {
			grouped.set(key, [line]);
		}
	}

	const docSections = SECTIONS.filter((s) => grouped.has(s.key))
		.map((s) => `## ${s.title}\n\n${grouped.get(s.key)!.join("\n")}`)
		.join("\n\n");

	const content = `# Clanker Support

> An AI-powered support agent for your site — install it with one script tag or one React Server Component (${RSC_PACKAGE} on npm). It answers from your docs and sources, then escalates to your team. Open source (MIT) and self-hostable (bring your own keys); the hosted version has flat monthly plans from $${STARTER}/mo with no per-seat fees.

## Key facts

- Install via one \`<script>\` tag (isolated shadow DOM, no build step), the React/Next.js SDK (\`${RSC_PACKAGE}\`, React 19), a WordPress plugin, or a Shopify theme app extension.
- Answers from a per-project knowledge base — page URLs, text snippets, and Q&A pairs — with your own instructions and model choice.
- Escalates to your team when it can't help: email + optional Slack notification, a handoff recap for the visitor, and the agent stands down once a human replies.
- Replies from the team inbox reach the visitor in the widget and by email; visitor email replies thread back into the same conversation.
- Quality signals: per-message thumbs up/down plus a 1–5 CSAT rating.
- Open source (MIT): ${GITHUB_URL} — self-host free with your own LLM Gateway key.
- Hosted plans: Starter $${STARTER}/mo, Growth $${GROWTH}/mo, Scale $${SCALE}/mo — metered by AI responses, no per-seat fees, annual = two months free.
- Site: ${SITE_URL} · Docs: ${DOCS_URL} · Dashboard: ${DASHBOARD_URL}

## Product pages

- [Home](${SITE_URL}): What Clanker Support is and how the drop-in agent works.
- [Pricing](${SITE_URL}/pricing): Hosted plans and what each includes.
- [Machine-readable pricing](${SITE_URL}/pricing.md): Plans in plain markdown.
- [Live demo](${SHOWCASE_URL}): The real widget running on a first-party demo page.
- [React / Next.js SDK](${RSC_NPM_URL}): ${RSC_PACKAGE} on npm.
- [GitHub](${GITHUB_URL}): The open-source (MIT) codebase.

${docSections}`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
