import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Static, machine-readable pricing for AI agents evaluating the product. Honest
// about the in-flight pricing: self-host is free, hosted is moving to
// usage-based (per message) with the exact price still to be announced. No
// invented numbers.
export const dynamic = "force-static";

const PRICING = `# Pricing — Clanker Support

Clanker Support is an AI-powered support agent. It is open and self-hostable.

## Self-hosted
- Price: Free
- You run it yourself and bring your own keys and infrastructure (an LLM Gateway key and a database).
- Full feature set; no usage limits imposed by us.

## Hosted (clankersupport.com)
- Model: Usage-based — billed per message, where one message = one agent response.
- Free tier: none.
- Exact per-message price and any trial: to be announced.
- Interim: a flat Pro plan ($29 / month, via Stripe) is available while usage-based pricing is finalized.

More: ${CANONICAL_SITE_URL}/docs
`;

export function GET() {
	return new Response(PRICING, {
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
