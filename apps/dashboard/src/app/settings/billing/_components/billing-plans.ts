import type { Plan } from "@/lib/workspace-utils";

/**
 * Pricing tiers shown on the billing page. These are static product copy (not
 * fetched from Stripe), so the displayed price must be kept in sync with the
 * Stripe price behind STRIPE_PRO_PRICE_ID. Only Pro maps to a live checkout;
 * Free is the default plan.
 *
 * `plan` ties a tier to the internal workspace plan enum so we can mark the
 * caller's current tier.
 */
export interface PricingTier {
	id: "free" | "pro";
	plan: Plan;
	name: string;
	price: string;
	tagline: string;
	features: string[];
	popular?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
	{
		id: "free",
		plan: "free",
		name: "Free",
		price: "$0",
		tagline: "For starters",
		features: [
			"1 project",
			"1,000 messages / month",
			"Basic AI models",
			"Community support",
		],
	},
	{
		id: "pro",
		plan: "pro",
		name: "Pro",
		price: "$29",
		tagline: "For growing teams",
		popular: true,
		features: [
			"Unlimited projects",
			"10,000 messages / month",
			"All AI models",
			"Priority support",
			"Custom branding",
		],
	},
];
