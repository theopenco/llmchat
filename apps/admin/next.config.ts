import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

// The admin console talks only to our own API (metrics + Better Auth), so that's
// the sole cross-origin connect target.
const connectSrc = ["'self'", API_URL, "ws:", "wss:"].filter(Boolean).join(" ");

// Shipped Report-Only (mirrors the dashboard): observe violations before
// promoting to an enforcing header.
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
	// This is an internal console — never index it.
	{ key: "X-Robots-Tag", value: "noindex, nofollow" },
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
