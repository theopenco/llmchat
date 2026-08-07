import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

const config: NextConfig = {
	reactStrictMode: true,
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
			// showcase.clankersupport.com is retired; the domain is re-pointed at
			// THIS app in the Ploy dashboard, and this host-matched rule 301s
			// every published link (blog posts, dev.to, old llms.txt captures) to
			// the homepage — where the embedded bubble IS the live agent those
			// links promised.
			{
				source: "/:path*",
				has: [{ type: "host", value: "showcase.clankersupport.com" }],
				destination: "https://clankersupport.com",
				// A literal 301 (permanent: true would emit a 308) so the
				// post-cutover check `curl -I` reads exactly as documented.
				statusCode: 301,
			},
		];
	},
};

export default withContentCollections(config);
