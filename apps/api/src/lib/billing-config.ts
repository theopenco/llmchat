// Maps a paid tier to the Stripe price ids that bill it. Price ids are env
// config (the collaborator creates them in Stripe and sets them in .env →
// ploy.yaml); they are NEVER hardcoded and there are no real dollar amounts in
// code. A tier whose price id is unset reads back undefined, and the billing
// route short-circuits with `billing_not_configured` rather than calling Stripe.

import { subscriptionPriceIds } from "@/lib/stripe";

import { PAID_PLANS, isPaidPlan } from "@llmchat/shared";

import type { BillingInterval, PaidPlan, Plan } from "@llmchat/shared";

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

/**
 * Every configured BASE price id → the tier it bills, across both cadences.
 *
 * Overage price ids are deliberately EXCLUDED: a metered overage line rides
 * alongside the base price on the same subscription, and it's the base price
 * that names the tier. Including them would make the answer depend on line
 * ordering.
 */
export function basePriceToPlan(vars: Vars): Map<string, PaidPlan> {
	const map = new Map<string, PaidPlan>();
	for (const plan of PAID_PLANS) {
		for (const interval of ["month", "year"] as const) {
			const id = planPrices(vars, plan, interval).basePriceId?.trim();
			if (id) map.set(id, plan);
		}
	}
	return map;
}

/** The tier billed by the first recognized base price in `priceIds`, or
 * undefined when none of them is a configured base price. */
export function planForPriceIds(
	vars: Vars,
	priceIds: readonly string[],
): PaidPlan | undefined {
	const map = basePriceToPlan(vars);
	for (const id of priceIds) {
		const plan = map.get(id.trim());
		if (plan) return plan;
	}
	return undefined;
}

/**
 * The tier a Stripe subscription actually entitles, and the single decision
 * both the webhook and the reconciliation cron use.
 *
 * Paid-only: anything but an active (or trialing) subscription is "none".
 *
 * `trialing` is still honored even though Checkout no longer creates trials:
 * the status can still arrive from a trial an operator grants by hand in the
 * Stripe dashboard, and from any subscription that was already trialing when
 * the 7-day trial was removed. Both are legitimately entitled.
 *
 * The PRICE the subscription bills is the authority, NOT `metadata.plan`.
 * Metadata is stamped once at Checkout and never re-stamped, so any plan change
 * made outside Checkout — notably a downgrade in the Stripe Billing Portal —
 * leaves it stale. Trusting it let a customer switch Scale→Starter in the
 * portal and keep Scale entitlements while paying Starter.
 *
 * Metadata remains the FALLBACK for a subscription whose price we don't
 * recognize (a legacy or hand-made price in Stripe): dropping a genuinely
 * paying customer to "none" over an unconfigured price id would be worse than
 * honoring the stamp.
 */
export function planForSubscription(
	vars: Vars,
	sub: {
		status?: unknown;
		items?: { data?: Array<{ price?: { id?: string } }> };
		metadata?: Record<string, string> | null;
	},
): Plan {
	const active = sub.status === "active" || sub.status === "trialing";
	if (!active) return "none";
	const fromPrice = planForPriceIds(vars, subscriptionPriceIds(sub));
	if (fromPrice) return fromPrice;
	const stamped = sub.metadata?.plan;
	return isPaidPlan(stamped) ? stamped : "none";
}
