import { ApiError, api } from "./api";

import type { PaidPlan, Plan, TierEntitlements } from "@llmchat/shared";

/** True when the api short-circuited because Stripe isn't configured yet (503
 * `billing_not_configured`). Lets the UI show "billing isn't enabled" copy
 * rather than a generic failure. */
export function isBillingNotConfigured(error: unknown): boolean {
	if (!(error instanceof ApiError)) return false;
	try {
		return (
			(JSON.parse(error.body) as { error?: string }).error ===
			"billing_not_configured"
		);
	} catch {
		return false;
	}
}

/** Owner-only. Starts Checkout for a specific paid tier; returns the Stripe
 * Checkout URL to redirect the browser to. `returnTo` is an in-app path Stripe
 * sends the browser back to (defaults server-side to the billing page) — the
 * onboarding paywall passes "/onboarding" so paying resumes the flow. */
export async function startCheckout(
	workspaceId: string,
	plan: PaidPlan,
	returnTo?: string,
): Promise<string> {
	const { url } = await api<{ url: string }>("/billing/checkout", {
		method: "POST",
		workspaceId,
		body: { plan, returnTo },
	});
	return url;
}

/** Current plan + real usage-this-month for a workspace. Powers the billing
 * screen's plan card and usage meters — real numbers only. */
export interface UsageSummary {
	plan: Plan;
	entitlements: TierEntitlements;
	usage: { projects: number; members: number; responsesThisMonth: number };
	monthStartUnix: number;
}

export async function fetchUsage(workspaceId: string): Promise<UsageSummary> {
	return api<UsageSummary>("/billing/usage", { workspaceId });
}

/** Owner-only. Returns a Stripe Billing Portal URL to redirect the browser to. */
export async function openPortal(workspaceId: string): Promise<string> {
	const { url } = await api<{ url: string }>("/billing/portal", {
		method: "POST",
		workspaceId,
	});
	return url;
}
