import {
	BILLING_TIERS,
	ENTERPRISE_TIER,
	PAID_PLANS,
	TRIAL_PERIOD_DAYS,
	isUnlimited,
} from "@llmchat/shared";

import { CANONICAL_SITE_URL, SALES_EMAIL } from "@/lib/site-urls";

// Static, machine-readable pricing for AI agents evaluating the product. Prices
// and limits are generated from the shared BILLING_TIERS table (the same source
// the dashboard and Stripe use), so this endpoint can never drift from the real
// plans. Self-host is free; hosted is paid-only with three flat monthly tiers.
export const dynamic = "force-static";

const fmt = (n: number) => n.toLocaleString("en-US");

const TIER_NAME: Record<(typeof PAID_PLANS)[number], string> = {
	starter: "Starter",
	growth: "Growth",
	scale: "Scale",
};

function tierBlock(plan: (typeof PAID_PLANS)[number]): string {
	const t = BILLING_TIERS[plan];
	const overage = t.allowOverage
		? `${fmt(t.maxResponsesPerMonth)} bot responses/month included, then billed per additional response`
		: `${fmt(t.maxResponsesPerMonth)} bot responses/month (hard cap, no overage)`;
	const branding =
		t.branding === "custom"
			? "Custom branding (white-label)"
			: t.branding === "off"
				? 'No "Powered by" badge'
				: '"Powered by" badge';
	const seats = isUnlimited(t.maxMembers)
		? "unlimited team members"
		: `${t.maxMembers} team members`;
	return [
		`### ${TIER_NAME[plan]} — $${t.priceUsdMonthly}/month (or $${fmt(t.priceUsdAnnual)}/year — two months free)`,
		`- ${overage}`,
		`- ${t.maxProjects} projects, ${seats} (no per-seat fees)`,
		`- ${t.modelAccess === "all" ? "All models" : "Basic models"}; ${branding}`,
	].join("\n");
}

const PRICING = `# Pricing — Clanker Support

Clanker Support is an AI-powered support agent. It is open and self-hostable, with paid hosted plans.

## Self-hosted
- Price: Free
- You run it yourself and bring your own keys and infrastructure (an LLM Gateway key and a database).
- Same code as the hosted service; no usage limits imposed by us. One documented environment variable (\`INTERNAL_ACCOUNT_EMAILS\`) lifts the plan limits on your install.

## Hosted (clankersupport.com)
- Paid-only — there is no free hosted tier.
- Every plan starts with a ${TRIAL_PERIOD_DAYS}-day free trial: a card is required at signup, and the first charge happens when the trial ends. Cancel during the trial at no cost.
- Flat monthly plans billed via Stripe; no per-seat fees (seats are included per plan).
- Annual billing available on every plan at 10× the monthly price (two months free).
- 14-day money-back guarantee; cancel anytime.

${PAID_PLANS.map(tierBlock).join("\n\n")}

### Enterprise — custom pricing
- ${ENTERPRISE_TIER.features.join("\n- ")}
- Contact sales: ${SALES_EMAIL}

More: ${CANONICAL_SITE_URL}/pricing
`;

export function GET() {
	return new Response(PRICING, {
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}
