import { loadStripe } from "@stripe/stripe-js";

import { ApiError, api } from "./api";

import type {
	BillingInterval,
	PaidPlan,
	Plan,
	TierEntitlements,
} from "@llmchat/shared";

/** Publishable key (safe to expose). Read from env, never hardcoded. */
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

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

/** A created Stripe Checkout Session: its id (for Stripe.js) and hosted url. */
export interface CheckoutSession {
	id: string;
	url: string;
}

/** Owner-only. Creates a Checkout Session for a paid tier on the chosen billing
 * cadence (monthly or annual). `returnTo` is an in-app path Stripe returns the
 * browser to (defaults server-side to billing). */
export async function startCheckout(
	workspaceId: string,
	plan: PaidPlan,
	interval: BillingInterval = "month",
	returnTo?: string,
): Promise<CheckoutSession> {
	return api<CheckoutSession>("/billing/checkout", {
		method: "POST",
		workspaceId,
		body: { plan, interval, returnTo },
	});
}

/**
 * Redirect the browser to Stripe Checkout. Primary path uses the **publishable
 * key** via Stripe.js (`redirectToCheckout` by session id); falls back to the
 * hosted session url if the key is unset or Stripe.js can't load — so checkout
 * works either way. The secret key is never involved client-side.
 */
export async function redirectToStripeCheckout(
	session: CheckoutSession,
): Promise<void> {
	if (STRIPE_PUBLISHABLE_KEY) {
		try {
			// Initialize Stripe.js with the publishable key (a genuine client-side
			// use of the key). `redirectToCheckout(sessionId)` is feature-detected:
			// older Stripe.js exposes it; on builds where it's removed we fall back
			// to the hosted session url. Either way the redirect happens.
			const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
			const legacy = stripe as unknown as {
				redirectToCheckout?: (opts: {
					sessionId: string;
				}) => Promise<{ error?: unknown }>;
			};
			if (legacy?.redirectToCheckout) {
				const { error } = await legacy.redirectToCheckout({
					sessionId: session.id,
				});
				if (!error) return;
			}
		} catch {
			// fall through to the hosted url
		}
	}
	window.location.href = session.url;
}

/** Current plan + real usage-this-month for a workspace. Powers the billing
 * screen's plan card and usage meters — real numbers only. */
export interface UsageSummary {
	plan: Plan;
	/** True when this workspace is an exempt internal/founder account. */
	exempt: boolean;
	entitlements: TierEntitlements;
	usage: { projects: number; members: number; responsesThisMonth: number };
	/** Paid tiers currently purchasable (their Stripe price id is configured). */
	availablePlans: PaidPlan[];
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
