import type { Plan } from "@/lib/workspace-utils";

/**
 * Pricing tiers shown on the billing page. These are static product copy (not
 * fetched from Stripe), so the displayed price must be kept in sync with the
 * Stripe price behind STRIPE_PRO_PRICE_ID. Only Pro maps to a live checkout;
 * Business is sales-led (no price id), Free is the default plan.
 *
 * `plan` ties a tier to the internal workspace plan enum so we can mark the
 * caller's current tier. The "Business" tier maps to the internal "scale" plan.
 */
export interface PricingTier {
	id: "free" | "pro" | "business";
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
	{
		id: "business",
		plan: "scale",
		name: "Business",
		price: "$99",
		tagline: "For larger teams",
		features: [
			"Unlimited everything",
			"Team members",
			"Advanced analytics",
			"SLA & priority support",
			"Custom domain",
		],
	},
];

/**
 * Sales contact for the Business tier and the custom-plan banner. There is no
 * configured sales inbox yet — this is a placeholder to confirm before launch.
 * Kept as a mailto so the CTA is functional rather than a dead button.
 */
export const SALES_MAILTO =
	"mailto:sales@llmchat.app?subject=llmchat%20Business%20plan";
