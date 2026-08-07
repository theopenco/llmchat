import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

// The browser talks to the API and the LLM Gateway cross-origin, so they have to
// be allow-listed in connect-src or fetches would be blocked.
const connectSrc = [
	"'self'",
	API_URL,
	"https://api.llmgateway.io",
	"https://api.stripe.com",
	"ws:",
	"wss:",
]
	.filter(Boolean)
	.join(" ");

// The billing page loads @stripe/stripe-js, whose script, controller iframe,
// and API calls each need their documented hosts — the Stripe.js set from
// https://docs.stripe.com/security/guide?csp=csp-js (`*.js.stripe.com` lets
// Stripe start frames on other origins; `hooks.stripe.com` covers redirect
// payment methods). Without a frame-src, the iframe fell back to
// `default-src 'self'` and every billing visit logged a report-only
// violation (#196).
const stripeJs = "https://js.stripe.com https://*.js.stripe.com";

// Shipped Report-Only: a wrong directive would silently break data fetching, so
// we observe violations first and promote to an enforcing `Content-Security-Policy`
// (ideally with per-request nonces) once it's verified against a running app.
const csp = [
	"default-src 'self'",
	// API_URL: the layout self-dogfoods the widget, whose script is served by
	// the api origin — cross-origin in prod, so without it the dogfood embed is
	// the next report-only noise source (and breaks the day this is enforced).
	`script-src 'self' 'unsafe-inline' 'unsafe-eval' ${stripeJs} ${API_URL}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	`connect-src ${connectSrc}`,
	`frame-src 'self' ${stripeJs} https://hooks.stripe.com`,
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
	transpilePackages: ["@llmchat/shared", "@llmchat/widget"],
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};

export default config;
