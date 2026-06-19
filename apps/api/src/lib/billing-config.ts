// Maps a paid tier to the Stripe price ids that bill it. Price ids are env
// config (the collaborator creates them in Stripe and sets them in .env →
// ploy.yaml); they are NEVER hardcoded and there are no real dollar amounts in
// code. A tier whose price id is unset reads back undefined, and the billing
// route short-circuits with `billing_not_configured` rather than calling Stripe.

import type { PaidPlan } from "@llmchat/shared";

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

/** Resolve the Stripe price ids for a paid tier from env. Starter has no
 * overage price (it hard-stops at the cap). */
export function planPrices(vars: Vars, plan: PaidPlan): PlanPrices {
	switch (plan) {
		case "starter":
			return { basePriceId: vars.STRIPE_PRICE_STARTER };
		case "growth":
			return {
				basePriceId: vars.STRIPE_PRICE_GROWTH,
				overagePriceId: vars.STRIPE_PRICE_GROWTH_OVERAGE,
			};
		case "scale":
			return {
				basePriceId: vars.STRIPE_PRICE_SCALE,
				overagePriceId: vars.STRIPE_PRICE_SCALE_OVERAGE,
			};
	}
}
