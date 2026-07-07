// Canonical cross-app URLs, baked in at build time from `ploy.yaml`. These
// always point at the stable production hosts (no preview suffix), so links
// from the marketing site resolve to `app.clankersupport.com` etc.
// regardless of which host the marketing site itself is served from.
export const CANONICAL_API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
export const CANONICAL_DASHBOARD_URL =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";
export const CANONICAL_SHOWCASE_URL =
	process.env.NEXT_PUBLIC_SHOWCASE_URL ?? "http://localhost:3003";

/** The marketing site's own canonical origin — the base for metadataBase,
 * canonical tags, the sitemap, and robots. Falls back to the production host
 * (this site *is* clankersupport.com) so SEO URLs are absolute even when
 * NEXT_PUBLIC_SITE_URL isn't set. */
export const CANONICAL_SITE_URL =
	process.env.NEXT_PUBLIC_SITE_URL ?? "https://clankersupport.com";

/** Where the Enterprise / "Contact sales" CTA points. Overridable per
 * environment; defaults to a sales mailbox on the canonical domain. */
export const SALES_EMAIL =
	process.env.NEXT_PUBLIC_SALES_EMAIL ?? "sales@clankersupport.com";

/** The product docs / knowledge base (the Fumadocs app) — its own host, not a
 * marketing route. `/docs` on this site 308-redirects here (next.config.ts);
 * internal links should point at this URL directly and skip the hop. */
export const DOCS_URL =
	process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.clankersupport.com";

/** Public community / social links surfaced in the header and footer. The
 * GitHub repo doubles as the source for the live star count in the navbar. */
export const GITHUB_REPO = "theopenco/llmchat";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const RSC_PACKAGE = "@clankersupport/widget-rsc";
export const RSC_NPM_URL = `https://www.npmjs.com/package/${RSC_PACKAGE}`;
export const DISCORD_URL = "https://discord.gg/RnyjHWuTKP";
export const X_URL = "https://x.com/ClankrSupport";
