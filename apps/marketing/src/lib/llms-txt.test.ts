import {
	BILLING_TIERS,
	DEFAULT_MODEL,
	WEB_SEARCH_MODELS,
	formatUsd,
} from "@llmchat/shared";
import { describe, expect, it } from "vitest";

import { buildLlmsTxt } from "./llms-txt";
import { CANONICAL_SHOWCASE_URL, DOCS_URL } from "./site-urls";

const BASE = "https://clankersupport.com";

const input = {
	posts: [
		{
			slug: "introducing-llmchat",
			title: "Introducing Clanker Support",
			description: "Why we built it.",
		},
	],
	competitors: [
		{ id: "intercom", name: "Intercom", tldr: "Lighter and cheaper." },
	],
	migrations: [
		{ slug: "intercom", name: "Intercom", tagline: "Move in an afternoon." },
	],
	features: [
		{
			slug: "drop-in-widget",
			name: "Drop-in widget",
			tagline: "One script tag.",
		},
	],
	useCases: [
		{
			slug: "ecommerce",
			name: "E-commerce stores",
			tagline: "Answer shipping questions instantly.",
		},
	],
	tools: [
		{
			slug: "csat-calculator",
			name: "CSAT calculator",
			tagline: "Score your support in seconds.",
		},
	],
};

describe("buildLlmsTxt", () => {
	const out = buildLlmsTxt(BASE, input);

	it("follows the llms.txt shape: H1, then a one-line blockquote summary", () => {
		const lines = out.split("\n");
		expect(lines[0]).toBe("# Clanker Support");
		expect(lines[2].startsWith("> ")).toBe(true);
	});

	it("links the core product pages with absolute URLs, incl. pricing.md", () => {
		expect(out).toContain(`(${BASE}/)`);
		// Docs live on their own host (the Fumadocs app), not a marketing route.
		expect(out).toContain(`(${DOCS_URL})`);
		expect(out).toContain(`(${BASE}/compare)`);
		expect(out).toContain(`(${BASE}/templates)`);
		expect(out).toContain(`(${BASE}/pricing.md)`);
	});

	it("enumerates comparisons, migration guides, and journal posts", () => {
		expect(out).toContain(`[Clanker Support vs Intercom](${BASE}/vs/intercom)`);
		expect(out).toContain(`(${BASE}/docs/migrate/intercom)`);
		expect(out).toContain(`(${BASE}/blog/introducing-llmchat)`);
		expect(out).toContain("## Comparisons");
		expect(out).toContain("## Migration guides");
		expect(out).toContain("## Journal");
	});

	it("enumerates the free tools", () => {
		expect(out).toContain("## Free tools");
		expect(out).toContain(
			`[CSAT calculator](${BASE}/tools/csat-calculator): Score your support in seconds.`,
		);
	});

	it("enumerates the features and use-cases", () => {
		expect(out).toContain("## Features");
		expect(out).toContain(
			`[Drop-in widget](${BASE}/features/drop-in-widget): One script tag.`,
		);
		expect(out).toContain("## Use cases");
		expect(out).toContain(
			`[AI support for E-commerce stores](${BASE}/use-cases/ecommerce): Answer shipping questions instantly.`,
		);
	});

	it("uses the 'support agent' positioning, never 'chatbot'", () => {
		expect(out.toLowerCase()).toContain("support agent");
		expect(out.toLowerCase()).not.toContain("chatbot");
	});

	it("presents both install paths: script tag AND the React SDK", () => {
		expect(out).toContain("script tag");
		expect(out).toContain("npm install @clankersupport/widget-rsc");
		expect(out).toContain("Server Component");
		expect(out).toContain("@clankersupport/widget-rsc/headless");
		expect(out).toContain(".clanker-*");
		expect(out).toContain(
			"(https://www.npmjs.com/package/@clankersupport/widget-rsc)",
		);
	});

	it("links the GitHub repo for the open-source / self-host story", () => {
		expect(out).toContain("(https://github.com/theopenco/llmchat)");
	});

	it("links the live demo and the legal pages (Optional section)", () => {
		expect(out).toContain(`(${CANONICAL_SHOWCASE_URL})`);
		expect(out).toContain("## Optional");
		expect(out).toContain(`(${BASE}/privacy-policy)`);
		expect(out).toContain(`(${BASE}/terms-of-use)`);
	});

	it("derives prices from BILLING_TIERS so the summary can never drift", () => {
		const now = (n: number) => `$${formatUsd(n)}/mo`;
		expect(out).toContain(now(BILLING_TIERS.starter.priceUsdMonthly));
		expect(out).toContain(now(BILLING_TIERS.growth.priceUsdMonthly));
		expect(out).toContain(now(BILLING_TIERS.scale.priceUsdMonthly));
	});

	// The WordPress plugin ships in-repo but is pending wordpress.org review —
	// once the directory listing is live, drop that assertion and add the
	// plugin as a third install path instead.
	it("never mentions unshipped integrations in the static copy", () => {
		const staticOnly = buildLlmsTxt(BASE, {
			posts: [],
			competitors: [],
			migrations: [],
			features: [],
			useCases: [],
			tools: [],
		}).toLowerCase();
		expect(staticOnly).not.toContain("wordpress");
		expect(staticOnly).not.toContain("shopify");
	});

	it("ends with a single trailing newline and emits no empty links", () => {
		expect(out.endsWith("\n")).toBe(true);
		expect(out.endsWith("\n\n")).toBe(false);
		expect(out).not.toContain("]()");
	});

	it("omits a section when its collection is empty", () => {
		const out2 = buildLlmsTxt(BASE, { ...input, posts: [], tools: [] });
		expect(out2).not.toContain("## Journal");
		expect(out2).not.toContain("## Free tools");
	});

	// The #233 AI-SEO audit added a Models line derived from the shared
	// web-search snapshot (the same list the dashboard picker and chat guard
	// read), so answer engines ingest the real selectable set. These guard the
	// derivation: a regression that hardcodes a stale list, drops the default,
	// or empties the enumeration is what we want to catch.
	it("enumerates the selectable web-search models from the shared snapshot", () => {
		expect(out).toContain(`Models: ${WEB_SEARCH_MODELS.length} web-search`);
		// Every model in the snapshot is listed verbatim — no silent truncation.
		for (const id of WEB_SEARCH_MODELS) {
			expect(out).toContain(id);
		}
	});

	it("names the default model in the Models line", () => {
		expect(out).toContain(`default \`${DEFAULT_MODEL}\``);
		// The snapshot is non-empty (shared throws if it ever blanks) — guard
		// against a formatting change that drops the count to zero.
		expect(WEB_SEARCH_MODELS.length).toBeGreaterThan(0);
	});
});
