import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

// The browser talks to the API and the LLM Gateway cross-origin, so they have to
// be allow-listed in connect-src or fetches would be blocked.
const connectSrc = [
	"'self'",
	API_URL,
	"https://api.llmgateway.io",
	"ws:",
	"wss:",
]
	.filter(Boolean)
	.join(" ");

// Shipped Report-Only: a wrong directive would silently break data fetching, so
// we observe violations first and promote to an enforcing `Content-Security-Policy`
// (ideally with per-request nonces) once it's verified against a running app.
const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	`connect-src ${connectSrc}`,
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

// Enforced headers are the ones that can't break a working app.
const securityHeaders = [
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
	},
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{ key: "Content-Security-Policy-Report-Only", value: csp },
];

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/shared"],
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default config;
