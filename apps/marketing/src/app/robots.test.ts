import { describe, expect, it } from "vitest";

import robots from "./robots";
import { CANONICAL_SITE_URL } from "../lib/site-urls";

// The November AI-SEO audit (#233) made robots.ts emit a dedicated allow rule
// for named AI / answer-engine crawlers alongside the wildcard rule. These
// tests pin that intent so a future edit can't silently drop the site back to
// a single wildcard rule (or empty the crawler list), which would un-list the
// site from the assistants it deliberately wants to be cited by.
describe("robots", () => {
	const result = robots();
	const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

	it("keeps a wildcard allow rule so every crawler may index the site", () => {
		const wildcard = rules.find((r) => r.userAgent === "*");
		expect(wildcard).toBeDefined();
		expect(wildcard!.allow).toBe("/");
		expect(wildcard!.disallow).toBeUndefined();
	});

	it("explicitly allows the major AI / answer-engine crawlers", () => {
		// The rule whose userAgent is a named list (not the "*" wildcard).
		const aiRule = rules.find((r) => Array.isArray(r.userAgent));
		expect(aiRule).toBeDefined();
		expect(aiRule!.allow).toBe("/");

		const agents = aiRule!.userAgent as string[];
		// A representative crawler from each assistant family the audit targeted —
		// losing any of these is the regression we care about.
		for (const bot of [
			"GPTBot",
			"ClaudeBot",
			"PerplexityBot",
			"Google-Extended",
			"Bingbot",
		]) {
			expect(agents).toContain(bot);
		}
		// No AI crawler may be blocked — every named agent must allow "/".
		expect(agents.length).toBeGreaterThan(0);
	});

	it("never disallows any path (the site is fully crawlable)", () => {
		for (const rule of rules) {
			expect(rule.disallow).toBeUndefined();
		}
	});

	it("points the sitemap at the canonical site URL", () => {
		expect(result.sitemap).toBe(`${CANONICAL_SITE_URL}/sitemap.xml`);
	});
});
