import { createMDX } from "fumadocs-mdx/next";

import type { NextConfig } from "next";

const withMDX = createMDX();

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
	// Keep dev artifacts out of .next so `next build` and the ploy-managed dev
	// server never fight over the same directory.
	distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
	reactStrictMode: true,
	poweredByHeader: false,
	transpilePackages: ["@llmchat/shared"],
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default withMDX(config);
