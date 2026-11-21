import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

// Public-site security headers (the dashboard/admin ship the same baseline
// plus their CSPs). Safe for static marketing content: nothing here can block
// a script or a fetch.
const securityHeaders = [
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "SAMEORIGIN" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), geolocation=(), browsing-topics=()",
	},
];

const config: NextConfig = {
	reactStrictMode: true,
	poweredByHeader: false,
	transpilePackages: ["@llmchat/shared"],
	// Every page renders SiteHeader, whose GitHubStars fetch (revalidate: 600)
	// makes the whole page ISR. Next then stamps HTML with `s-maxage=600,
	// stale-while-revalidate=<expireTime - 600>`, and expireTime defaults to a
	// YEAR. On Ploy (unlike Vercel) that header reaches the visitor's browser,
	// which is licensed to paint a year-stale cached copy while revalidating in
	// the background — and Ploy drops the previous deployment's hashed
	// /_next/static assets, so the stale HTML's CSS href 404s and the first
	// load after any deploy renders unstyled (refresh = revalidated HTML =
	// fixed). Pinning expireTime at the revalidate interval makes
	// `revalidate >= expireTime`, which drops the stale-while-revalidate
	// directive entirely (see Next's formatRevalidate): browsers ignore
	// s-maxage, so HTML is always revalidated before paint. Keep this ≤ the
	// smallest fetch/page revalidate used in the app, or the SWR window comes
	// back for that page.
	expireTime: 600,
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
	async redirects() {
		return [
			// The old marketing /docs page moved to the dedicated docs app.
			// Exact-path only: /docs/migrate/* are marketing-owned migration
			// guides and must keep resolving here.
			{
				source: "/docs",
				destination:
					process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.clankersupport.com",
				permanent: true,
			},
		];
	},
};

export default withContentCollections(config);
