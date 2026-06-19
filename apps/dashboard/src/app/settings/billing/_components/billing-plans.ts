import type { Plan } from "@/lib/workspace-utils";

/**
 * The hosted plan shown on the billing page. Static product copy (not fetched
 * from Stripe), so the displayed price must stay in sync with the Stripe price
 * behind STRIPE_PRO_PRICE_ID.
 *
 * Interim state: the free tier has been removed (hosted is moving to usage-based
 * per-message pricing — see the billing notice). Pro remains the one live,
 * self-serve checkout. We list only capabilities, never invented usage limits.
 *
 * `plan` ties the tier to the internal workspace plan enum so we can mark the
 * caller's current tier.
 */
export interface PricingTier {
	id: "pro";
	plan: Plan;
	name: string;
	price: string;
	tagline: string;
	features: string[];
}

export const PRICING_TIERS: PricingTier[] = [
	{
		id: "pro",
		plan: "pro",
		name: "Pro",
		price: "$29",
		tagline: "For growing teams",
		features: [
			"Unlimited projects",
			"All AI models",
			"Priority support",
			"Custom branding",
		],
	},
];

/** The single live tier. Convenience accessor so cards don't re-find it. */
export const PRO_TIER = PRICING_TIERS[0];
