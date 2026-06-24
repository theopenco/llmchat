// Maps a paid tier to the Stripe price ids that bill it. Price ids are env
// config (the collaborator creates them in Stripe and sets them in .env →
// ploy.yaml); they are NEVER hardcoded and there are no real dollar amounts in
// code. A tier whose price id is unset reads back undefined, and the billing
// route short-circuits with `billing_not_configured` rather than calling Stripe.

import type { BillingInterval, PaidPlan } from "@llmchat/shared";

import type { AppContext } from "@/env";

type Vars = AppContext["Bindings"]["vars"];

/** The Stripe Billing Meter event name responses are reported under. Must match
 * the meter the collaborator creates in Stripe; overridable via env. */
const DEFAULT_METER_EVENT = "clanker_response";

export function meterEventName(vars: Vars): string {
	return vars.STRIPE_METER_EVENT?.trim() || DEFAULT_METER_EVENT;
}

export interface PlanPrices {
	/** Flat base subscription price for the tier. */
	basePriceId?: string;
	/** Metered overage price (Growth/Scale only). */
	overagePriceId?: string;
}

/**
 * Resolve the Stripe price ids for a paid tier from env. Starter has no overage
 * price (it hard-stops at the cap).
 *
 * `interval` selects the flat base price: the monthly STRIPE_PRICE_* id, or the
 * annual STRIPE_PRICE_*_ANNUAL id (two months free). The metered OVERAGE price
 * is the same for both cadences — overage is reported from per-response meter
 * events monthly regardless of how the base subscription is billed.
 */
export function planPrices(
	vars: Vars,
	plan: PaidPlan,
	interval: BillingInterval = "month",
): PlanPrices {
	const annual = interval === "year";
	switch (plan) {
		case "starter":
			return {
				basePriceId: annual
					? vars.STRIPE_PRICE_STARTER_ANNUAL
					: vars.STRIPE_PRICE_STARTER,
			};
		case "growth":
			return {
				basePriceId: annual
					? vars.STRIPE_PRICE_GROWTH_ANNUAL
					: vars.STRIPE_PRICE_GROWTH,
				overagePriceId: vars.STRIPE_PRICE_GROWTH_OVERAGE,
			};
		case "scale":
			return {
				basePriceId: annual
					? vars.STRIPE_PRICE_SCALE_ANNUAL
					: vars.STRIPE_PRICE_SCALE,
				overagePriceId: vars.STRIPE_PRICE_SCALE_OVERAGE,
			};
	}
}
