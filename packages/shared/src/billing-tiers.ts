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
	/** Display price in whole USD per month. 0 for the unpaid state. Must match
	 * the Stripe price behind this tier's STRIPE_PRICE_* id. */
	priceUsdMonthly: number;
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
	},
	starter: {
		maxProjects: 2,
		maxMembers: 3,
		maxResponsesPerMonth: 2_000,
		allowOverage: false, // hard stop at the cap — no overage
		modelAccess: "basic",
		branding: "badge",
		priceUsdMonthly: 19,
	},
	growth: {
		maxProjects: 5,
		maxMembers: 8,
		maxResponsesPerMonth: 8_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "off",
		priceUsdMonthly: 89,
	},
	scale: {
		maxProjects: 15,
		maxMembers: 20,
		maxResponsesPerMonth: 25_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "custom",
		priceUsdMonthly: 299,
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
	maxProjects: Number.MAX_SAFE_INTEGER,
	maxMembers: Number.MAX_SAFE_INTEGER,
	maxResponsesPerMonth: Number.MAX_SAFE_INTEGER,
	allowOverage: false,
	modelAccess: "all",
	branding: "custom",
	priceUsdMonthly: 0,
};

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
