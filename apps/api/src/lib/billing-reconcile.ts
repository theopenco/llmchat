// Nightly plan reconciliation: re-derive every workspace's stored tier from
// Stripe and correct the drift.
//
// Why this exists: `workspace.plan` was only ever written by an inbound Stripe
// webhook. A webhook that is never delivered — an endpoint disabled or
// misconfigured in Stripe, an event type not subscribed, a delivery that
// exhausts Stripe's retries, or (on this platform) a Ploy resolver timeout that
// drops the request — leaves a workspace stamped on whatever tier it last had,
// forever. A trial that lapsed or a subscription that was canceled would keep
// full Scale entitlements indefinitely, with nothing in the system to notice.
//
// This closes the loop: Stripe is the source of truth, the cron is the audit.
//
// Conservative by construction. It only ever corrects a plan it could VERIFY
// against Stripe; anything it cannot verify (a transient API failure, a paid
// plan with no subscription id to look up) is counted and reported, never
// auto-demoted. A Stripe outage must not mass-downgrade paying customers.

import { planForSubscription } from "@/lib/billing-config";
import { db } from "@/lib/db";
import { notifyBillingDrift } from "@/lib/discord";
import { StripeError, retrieveSubscription } from "@/lib/stripe";

import { eq, isNotNull, ne, or, workspace } from "@llmchat/db";

import type { Env } from "@/env";
import type { Plan } from "@llmchat/shared";

// Cron schedule — MUST match the cron: block in apps/api/ploy.yaml. 03:00 UTC
// daily: off-peak, and well clear of the 08:00 traffic-report window.
export const BILLING_RECONCILE_CRON = "0 3 * * *";

/** Safety valve on a single run's Stripe call budget. Far above the real
 * workspace count; a run that hits it logs and reconciles the rest tomorrow. */
const MAX_WORKSPACES = 500;

export interface PlanCorrection {
	workspaceId: string;
	from: string;
	to: string;
	/** The Stripe fact that drove the correction (a status, or "missing"). */
	reason: string;
}

export interface ReconcileResult {
	/** Workspaces examined (those with a subscription id or a non-none plan). */
	checked: number;
	corrections: PlanCorrection[];
	/** Examined but not verifiable against Stripe — left untouched. */
	unverified: number;
	/** True when the run was skipped for missing config. */
	skipped: boolean;
}

/**
 * Reconcile stored plans against Stripe.
 *
 * Scope: workspaces that either carry a `stripeSubscriptionId` or sit on a
 * non-"none" plan. A workspace with neither has nothing to drift.
 *
 * Skips quietly when STRIPE_SECRET_KEY is unset (self-hosters and local dev run
 * without billing), mirroring every other optional integration.
 */
export async function runBillingReconcile(env: Env): Promise<ReconcileResult> {
	const result: ReconcileResult = {
		checked: 0,
		corrections: [],
		unverified: 0,
		skipped: false,
	};

	const secretKey = env.vars.STRIPE_SECRET_KEY?.trim();
	if (!secretKey) {
		console.log("billing-reconcile: skipped — STRIPE_SECRET_KEY unset");
		result.skipped = true;
		return result;
	}

	const rows = await db(env)
		.select({
			id: workspace.id,
			plan: workspace.plan,
			stripeSubscriptionId: workspace.stripeSubscriptionId,
		})
		.from(workspace)
		.where(
			or(isNotNull(workspace.stripeSubscriptionId), ne(workspace.plan, "none")),
		)
		.limit(MAX_WORKSPACES);

	if (rows.length === MAX_WORKSPACES) {
		console.warn(
			`billing-reconcile: hit the ${MAX_WORKSPACES}-workspace cap; remainder deferred to the next run`,
		);
	}

	for (const ws of rows) {
		result.checked++;

		// A paid plan with no subscription id is drift we cannot resolve from
		// here (it is also what gateWorkspace calls "billing_drift"). Report it
		// for a human — auto-demoting would also wipe hand-comped workspaces.
		if (!ws.stripeSubscriptionId) {
			result.unverified++;
			console.warn(
				`billing-reconcile: workspace ${ws.id} is on "${ws.plan}" with no stripeSubscriptionId — not auto-corrected`,
			);
			continue;
		}

		let expected: Plan;
		let reason: string;
		try {
			const sub = await retrieveSubscription(
				secretKey,
				ws.stripeSubscriptionId,
			);
			expected = planForSubscription(env.vars, sub);
			reason = String(sub.status);
		} catch (err) {
			// 404 ⇒ the subscription is genuinely gone from Stripe and the
			// customer.subscription.deleted webhook never landed. That is exactly
			// the drift this job exists for, and it IS verified: demote.
			if (err instanceof StripeError && err.status === 404) {
				expected = "none";
				reason = "missing";
			} else {
				// Anything else (network, 5xx, auth) is unknown, not "unsubscribed".
				result.unverified++;
				console.error(
					`billing-reconcile: could not verify workspace ${ws.id}`,
					err,
				);
				continue;
			}
		}

		if (expected === ws.plan) continue;

		await db(env)
			.update(workspace)
			.set({
				plan: expected,
				// Clear the dangling id when the subscription no longer exists, so
				// the next run treats the workspace as settled rather than re-probing
				// a 404 every night.
				...(reason === "missing" ? { stripeSubscriptionId: null } : {}),
			})
			.where(eq(workspace.id, ws.id));

		result.corrections.push({
			workspaceId: ws.id,
			from: ws.plan,
			to: expected,
			reason,
		});
		console.warn(
			`billing-reconcile: workspace ${ws.id} ${ws.plan} → ${expected} (stripe: ${reason})`,
		);
	}

	// Silence is the normal outcome — only ping when there is something to act on.
	if (result.corrections.length > 0 || result.unverified > 0) {
		await notifyBillingDrift(env, result);
	}

	return result;
}
