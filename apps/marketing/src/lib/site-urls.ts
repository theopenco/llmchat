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
