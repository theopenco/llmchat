/**
 * Billing tiers — the single source of truth for what each paid plan is
 * allowed. The API enforces these server-side (project creation, member count,
 * monthly response quota, model access, branding) and the dashboard reads the
 * same table to render pricing + gate UI, so the promise and the enforced
 * reality never drift.
 *
 * The hosted product is **paid-only**: there is no free tier. A workspace with
 * no active subscription sits at plan `"none"` — entitled to nothing — until a
 * Stripe Checkout completes and the webhook promotes it to a paid tier. Real
 * dollar amounts live in Stripe (price IDs are env-config) and in the dashboard
 * copy, never in this table — we encode entitlements, not prices.
 */

import { isBasicModel } from "./models";

/** `"none"` = no active subscription (blocked). The three paid tiers follow. */
export type Plan = "none" | "starter" | "growth" | "scale";

/** What a workspace may do at a given tier. `maxResponsesPerMonth` is the
 * *included* quota; whether exceeding it hard-stops or meters as overage is
 * `allowOverage`. */
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
}

export const BILLING_TIERS: Record<Plan, TierEntitlements> = {
	// Unpaid: blocked from everything until a subscription is active.
	none: {
		maxProjects: 0,
		maxMembers: 1,
		maxResponsesPerMonth: 0,
		allowOverage: false,
		modelAccess: "basic",
		branding: "badge",
	},
	starter: {
		maxProjects: 1,
		maxMembers: 1,
		maxResponsesPerMonth: 1_000,
		allowOverage: false, // hard stop at the cap — no overage
		modelAccess: "basic",
		branding: "badge",
	},
	growth: {
		maxProjects: 3,
		maxMembers: 5,
		maxResponsesPerMonth: 5_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "off",
	},
	scale: {
		maxProjects: 10,
		maxMembers: 20,
		maxResponsesPerMonth: 20_000,
		allowOverage: true,
		modelAccess: "all",
		branding: "custom",
	},
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
 * exact paid-tier match (set by the Stripe webhook) grants entitlement.
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
 * (Stripe meters the excess); fixed plans hard-stop at the included quota.
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
