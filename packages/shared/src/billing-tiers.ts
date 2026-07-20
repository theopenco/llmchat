/**
 * Billing tiers — the single source of truth for what each paid plan is
 * allowed AND its monthly price. The API enforces the entitlements server-side
 * (project/member caps, monthly response quota, model access, branding) and the
 * dashboard reads the same table to render pricing + gate UI, so the promise,
 * the enforced reality, and the displayed price never drift. The prices here
 * MUST match the Stripe prices behind STRIPE_PRICE_* (Stripe is the system of
 * record for charging; this table is the system of record for entitlements).
 *
 * The hosted product is **paid-only**: no free tier. A workspace with no active
 * subscription sits at plan `"none"` — entitled to nothing (a hard paywall sits
 * before onboarding, so building requires an active plan) until a Stripe
 * Checkout completes and the webhook promotes it to a paid tier.
 *
 * Internal/founder workspaces are exempt entirely (see INTERNAL_ENTITLEMENTS +
 * isInternalEmail) — full access without paying, resolved server-side.
 */

import { isBasicModel } from "./models";

/** `"none"` = no active subscription. The three paid tiers follow. */
export type Plan = "none" | "starter" | "growth" | "scale";

/** What a workspace may do at a given tier. `maxResponsesPerMonth` is the
 * *included* quota; whether exceeding it hard-stops or meters is `allowOverage`. */
export interface TierEntitlements {
	/** Hard cap on projects a workspace may own. */
	maxProjects: number;
	/** Hard cap on workspace members (seats). */
	maxMembers: number;
	/** Bot responses included per calendar month. */
	maxResponsesPerMonth: number;
	/** Beyond the monthly quota: false = hard stop (402), true = meter overage. */
	allowOverage: boolean;
	/** `"basic"` = the cheaper/mini model set only; `"all"` = every web-search model. */
	modelAccess: "basic" | "all";
	/**
	 * `"badge"` — the "Powered by" badge is shown and cannot be removed.
	 * `"off"`   — no badge.
	 * `"custom"`— no badge; custom branding permitted.
	 */
	branding: "badge" | "off" | "custom";
	/** Display price in whole USD per month (billed monthly). 0 for the unpaid
	 * state. Must match the Stripe price behind this tier's STRIPE_PRICE_* id. */
	priceUsdMonthly: number;
	/** Display price in whole USD per YEAR (billed annually). Set to 10× the
	 * monthly price — two months free — so annual is the cash-flow-positive
	 * default we nudge toward. 0 for the unpaid state. Must match the Stripe
	 * price behind this tier's STRIPE_PRICE_*_ANNUAL id. */
	priceUsdAnnual: number;
}

/** A subscription billing cadence. Annual = two months free (see
 * `priceUsdAnnual`); the API maps each to a distinct Stripe price id. */
export type BillingInterval = "month" | "year";

/**
 * Free-trial length (days) for a workspace's FIRST subscription. A card is
 * still collected at Checkout (`payment_method_collection: "always"`), but the
 * subscription starts in Stripe's `trialing` status — full plan entitlements,
 * no charge — and converts to `active` (first charge) when the trial ends.
 *
 * Single source of truth for every surface that mentions the trial (paywall,
 * billing screen, marketing pricing) AND for the api, which passes it to
 * Stripe Checkout as `subscription_data[trial_period_days]` — no Stripe
 * dashboard configuration is needed for the trial itself. Workspaces already
 * on a paid plan never get a trial on upgrade (see /billing/checkout).
 */
export const TRIAL_PERIOD_DAYS = 7;

/** Sentinel for an "unlimited" cap. Large enough that isWithinLimit() never
 * blocks, and recognized by isUnlimited() so the UI renders "Unlimited" instead
 * of a meaningless nine-digit number. */
export const UNLIMITED = Number.MAX_SAFE_INTEGER;

/** Whether a cap is effectively unlimited (so UI shows "Unlimited", not the raw
 * number). Treats any near-MAX_SAFE_INTEGER value — the UNLIMITED sentinel and
 * the internal-account caps — as unlimited. */
export function isUnlimited(n: number): boolean {
	return n >= 1_000_000;
}

export const BILLING_TIERS: Record<Plan, TierEntitlements> = {
	// Unpaid: entitled to nothing. A hard paywall before onboarding means an
	// unpaid workspace can't build (0 projects) and its agent serves nothing
	// (0 responses) until a subscription is active.
	none: {
		maxProjects: 0,
		maxMembers: 1,
		maxResponsesPerMonth: 0,
		allowOverage: false,
		modelAccess: "basic",
		branding: "badge",
		priceUsdMonthly: 0,
		priceUsdAnnual: 0,
	},
	starter: {
		maxProjects: 2,
		maxMembers: 3,
		maxResponsesPerMonth: 2_000,
		allowOverage: false, // hard stop at the cap — no overage
		modelAccess: "basic",
		branding: "badge",
		priceUsdMonthly: 19,
		priceUsdAnnual: 190, // 10× monthly — two months free
	},
	growth: {
		maxProjects: 5,
		maxMembers: 10,
		// Best unit economics step up the ladder: Growth's per-response value
		// ($89 / 12k ≈ $0.0074) beats Starter's ($19 / 2k ≈ $0.0095), so
		// upgrading is the rational move rather than a worse deal.
		maxResponsesPerMonth: 12_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "off",
		priceUsdMonthly: 89,
		priceUsdAnnual: 890, // 10× monthly — two months free
	},
	scale: {
		maxProjects: 20,
		// "No per-seat fees" taken to its conclusion: seats are unlimited at the
		// top self-serve tier (seats cost us nothing — responses are the metered
		// unit). Rendered as "Unlimited" via isUnlimited().
		maxMembers: UNLIMITED,
		maxResponsesPerMonth: 50_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "custom",
		priceUsdMonthly: 299,
		priceUsdAnnual: 2_990, // 10× monthly — two months free
	},
};

/**
 * Entitlements for an internal/founder workspace — full product access with no
 * billing. Not a purchasable plan: resolved server-side when the workspace
 * owner's email is on the internal allowlist (see isInternalEmail). Caps are set
 * absurdly high (effectively unlimited) and overage is off so nothing is ever
 * reported to Stripe for an exempt workspace.
 */
export const INTERNAL_ENTITLEMENTS: TierEntitlements = {
	maxProjects: UNLIMITED,
	maxMembers: UNLIMITED,
	maxResponsesPerMonth: UNLIMITED,
	allowOverage: false,
	modelAccess: "all",
	branding: "custom",
	priceUsdMonthly: 0,
	priceUsdAnnual: 0,
};

/**
 * Enterprise is **sold, not self-served**: there is no `Plan` value, no Stripe
 * Checkout, and no enforced entitlement table for it — provisioning is manual
 * (typically an internal/custom workspace with a bespoke contract). This
 * constant is display-only copy for the pricing page's "Contact sales" tier, so
 * the marketing and dashboard surfaces describe it consistently. It anchors the
 * page high (door-in-the-face) and captures volume/agency/regulated buyers.
 */
export const ENTERPRISE_TIER = {
	name: "Enterprise",
	tagline: "For agencies, high volume, and teams that need control.",
	features: [
		"Everything in Scale",
		"Custom response volume & pricing",
		"Unlimited projects & seats",
		"DPA on request; SSO/SAML & audit logs on the roadmap",
		"SLA + dedicated support channel",
		"White-glove onboarding & migration",
		"Self-host support contract",
	],
} as const;

/** The paid tiers, in upgrade order — what the pricing page offers. */
export const PAID_PLANS = ["starter", "growth", "scale"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: string | null | undefined): plan is PaidPlan {
	return (PAID_PLANS as readonly string[]).includes(plan ?? "");
}

/**
 * Resolve entitlements for a (possibly unknown/legacy) plan value. An
 * unrecognized plan — a typo, or a pre-migration value like `"free"`/`"pro"` —
 * resolves to `none` (blocked), the most restrictive state, so an unknown plan
 * can never grant access without an active subscription. Paid-only: only an
 * exact paid-tier match (set by the Stripe webhook) grants paid entitlement.
 */
export function planEntitlements(
	plan: Plan | string | null | undefined,
): TierEntitlements {
	return BILLING_TIERS[plan as Plan] ?? BILLING_TIERS.none;
}

/** True when one more item may be created — `count` is strictly under `max`.
 * Treats `max` as a hard ceiling: at `count === max`, no further items. */
export function isWithinLimit(count: number, max: number): boolean {
	return count < max;
}

/**
 * Whether a workspace at `plan` having served `used` responses this month must
 * be blocked from generating another. Plans with overage never block here
 * (Stripe meters the excess); fixed plans hard-stop at the included quota, and
 * the unpaid `none` state (quota 0) is blocked from the first response.
 */
export function isOverResponseQuota(
	plan: Plan | string | null | undefined,
	used: number,
): boolean {
	const t = planEntitlements(plan);
	if (t.allowOverage) return false;
	return used >= t.maxResponsesPerMonth;
}

/** Whether `modelId` is selectable at `plan`. `"all"` access permits any
 * web-search model; `"basic"` access is limited to the basic model set. */
export function isModelAllowed(
	plan: Plan | string | null | undefined,
	modelId: string,
): boolean {
	const t = planEntitlements(plan);
	if (t.modelAccess === "all") return true;
	return isBasicModel(modelId);
}

/** Whether the live widget must show the non-removable "Powered by" badge. */
export function showPoweredByBadge(
	plan: Plan | string | null | undefined,
): boolean {
	return planEntitlements(plan).branding === "badge";
}

/**
 * Whether `email` belongs to an internal/founder account, given the operator's
 * allowlist. Pure + case-insensitive; the caller supplies the allowlist (read
 * server-side from env). An empty/missing email is never internal.
 */
export function isInternalEmail(
	email: string | null | undefined,
	allowlist: readonly string[],
): boolean {
	if (!email) return false;
	const e = email.trim().toLowerCase();
	return allowlist.some((a) => a.trim().toLowerCase() === e);
}
