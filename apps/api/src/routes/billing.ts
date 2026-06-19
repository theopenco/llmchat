import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Context } from "hono";

import { planPrices } from "@/lib/billing-config";
import { db } from "@/lib/db";
import {
	memberCount,
	monthlyResponseCount,
	projectCount,
	startOfUtcMonth,
	workspacePlan,
} from "@/lib/plan";
import {
	StripeError,
	createCheckoutSession,
	createCustomer,
	createPortalSession,
	verifyStripeSignature,
} from "@/lib/stripe";
import {
	requireOwner,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import { eq, workspace } from "@llmchat/db";
import { PAID_PLANS, isPaidPlan, planEntitlements } from "@llmchat/shared";

import type { AppContext } from "@/env";
import type { Plan } from "@llmchat/shared";

const billingPage = (dashboardUrl: string, query = "") =>
	`${dashboardUrl}/settings/billing${query}`;

/** Build a post-Checkout return URL from an in-app path. Only same-app relative
 * paths are honored (must start with a single "/"); anything else falls back to
 * the billing page, so a crafted `returnTo` can't redirect off to another host. */
function returnUrl(
	dashboardUrl: string,
	returnTo: string | undefined,
	status: "success" | "cancel",
): string {
	const safe =
		typeof returnTo === "string" && /^\/(?!\/)/.test(returnTo)
			? returnTo
			: "/settings/billing";
	return `${dashboardUrl}${safe}?status=${status}`;
}

/** Billing is only live once the operator has set the Stripe secret and the
 * relevant price ids. Until then we short-circuit with a stable code the
 * dashboard renders gracefully — never an opaque 500 from a missing key. */
const configured = (value?: string) =>
	typeof value === "string" && value.trim() !== "";

/** Translate a reachable Stripe API error into a clean, logged 502 so real
 * failures stay diagnosable server-side instead of surfacing as opaque 500s.
 * Non-Stripe errors propagate unchanged. */
function stripeFailure(c: Context<AppContext>, err: unknown) {
	if (err instanceof StripeError) {
		console.error(`[billing] Stripe ${err.status}: ${err.body}`);
		return c.json({ error: "stripe_error" }, 502);
	}
	throw err;
}

/** Map a subscription's status + stamped plan to the tier we store. Paid-only:
 * anything but an active (or trialing) subscription resolves to "none", and an
 * unrecognized stamped plan is rejected to "none" rather than trusted. */
function planForSubscription(status: unknown, stampedPlan: unknown): Plan {
	const active = status === "active" || status === "trialing";
	const plan = typeof stampedPlan === "string" ? stampedPlan : undefined;
	if (active && isPaidPlan(plan)) return plan;
	return "none";
}

export const billing = new Hono<AppContext>()
	// Start a subscription Checkout for the chosen tier. Owner-only. Reuses the
	// workspace's Stripe customer if it has one, else creates and stores it (so
	// retries never create duplicate customers).
	.post(
		"/billing/checkout",
		requireSession,
		requireOwner,
		zValidator(
			"json",
			z.object({
				plan: z.enum(PAID_PLANS),
				returnTo: z.string().optional(),
			}),
		),
		async (c) => {
			const workspaceId = c.get("workspaceId");
			const userId = c.get("userId");
			const { plan, returnTo } = c.req.valid("json");
			const { STRIPE_SECRET_KEY, DASHBOARD_URL } = c.env.vars;
			const { basePriceId, overagePriceId } = planPrices(c.env.vars, plan);

			// Never call Stripe without the keys this tier needs. Overage tiers also
			// require their metered price id to be configured.
			const needsOverage = planEntitlements(plan).allowOverage;
			if (
				!configured(STRIPE_SECRET_KEY) ||
				!configured(basePriceId) ||
				(needsOverage && !configured(overagePriceId))
			) {
				return c.json({ error: "billing_not_configured" }, 503);
			}

			const ws = await db(c.env).query.workspace.findFirst({
				where: (w, { eq: e }) => e(w.id, workspaceId),
			});
			if (!ws) return c.json({ error: "workspace not found" }, 404);

			try {
				let customerId = ws.stripeCustomerId;
				if (!customerId) {
					const owner = await db(c.env).query.user.findFirst({
						where: (u, { eq: e }) => e(u.id, userId),
					});
					const customer = await createCustomer(STRIPE_SECRET_KEY, {
						email: owner?.email,
						metadata: { workspaceId },
					});
					customerId = customer.id;
					await db(c.env)
						.update(workspace)
						.set({ stripeCustomerId: customerId })
						.where(eq(workspace.id, workspaceId));
				}

				const session = await createCheckoutSession(STRIPE_SECRET_KEY, {
					customer: customerId,
					priceId: basePriceId!,
					overagePriceId: needsOverage ? overagePriceId : undefined,
					plan,
					workspaceId,
					successUrl: returnUrl(DASHBOARD_URL, returnTo, "success"),
					cancelUrl: returnUrl(DASHBOARD_URL, returnTo, "cancel"),
				});
				return c.json({ url: session.url });
			} catch (err) {
				return stripeFailure(c, err);
			}
		},
	)
	// Open the Stripe Billing Portal so the owner can manage/cancel. Owner-only.
	.post("/billing/portal", requireSession, requireOwner, async (c) => {
		const workspaceId = c.get("workspaceId");
		const { STRIPE_SECRET_KEY, DASHBOARD_URL } = c.env.vars;

		if (!configured(STRIPE_SECRET_KEY)) {
			return c.json({ error: "billing_not_configured" }, 503);
		}

		const ws = await db(c.env).query.workspace.findFirst({
			where: (w, { eq: e }) => e(w.id, workspaceId),
		});
		if (!ws?.stripeCustomerId) {
			return c.json({ error: "no billing customer" }, 400);
		}

		try {
			const session = await createPortalSession(STRIPE_SECRET_KEY, {
				customer: ws.stripeCustomerId,
				returnUrl: billingPage(DASHBOARD_URL),
			});
			return c.json({ url: session.url });
		} catch (err) {
			return stripeFailure(c, err);
		}
	})
	// Current plan + real usage-this-month for the active workspace. Any member
	// may read it (it powers the billing screen). Real numbers only — no
	// fabricated usage. Entitlements come straight from the shared tier table.
	.get("/billing/usage", requireSession, requireWorkspace, async (c) => {
		const workspaceId = c.get("workspaceId");
		const plan = await workspacePlan(c.env, workspaceId);
		const [projects, members, responses] = await Promise.all([
			projectCount(c.env, workspaceId),
			memberCount(c.env, workspaceId),
			monthlyResponseCount(c.env, workspaceId),
		]);
		return c.json({
			plan,
			entitlements: planEntitlements(plan),
			usage: { projects, members, responsesThisMonth: responses },
			monthStartUnix: startOfUtcMonth(),
		});
	})
	// Stripe webhook. No auth, no CORS — Stripe calls this directly. The body is
	// read raw (the exact bytes Stripe signed) and verified before any parsing.
	.post("/billing/webhook", async (c) => {
		const raw = await c.req.text();
		const valid = await verifyStripeSignature(
			raw,
			c.req.header("stripe-signature") ?? null,
			c.env.vars.STRIPE_WEBHOOK_SECRET,
		);
		if (!valid) return c.json({ error: "invalid signature" }, 400);

		const event = JSON.parse(raw) as {
			type: string;
			data: { object: Record<string, unknown> };
		};
		const d = db(c.env);

		switch (event.type) {
			case "checkout.session.completed": {
				const s = event.data.object;
				const meta = s.metadata as Record<string, string> | undefined;
				const workspaceId =
					(s.client_reference_id as string | undefined) ?? meta?.workspaceId;
				// The session completing means payment succeeded — promote to the
				// purchased tier (validated; an unknown stamp falls back to none).
				const plan = isPaidPlan(meta?.plan) ? meta.plan : "none";
				if (workspaceId) {
					await d
						.update(workspace)
						.set({
							stripeCustomerId: (s.customer as string) ?? undefined,
							stripeSubscriptionId: (s.subscription as string) ?? undefined,
							plan,
						})
						.where(eq(workspace.id, workspaceId));
				}
				break;
			}
			case "customer.subscription.updated": {
				const sub = event.data.object;
				const meta = sub.metadata as Record<string, string> | undefined;
				await d
					.update(workspace)
					.set({
						plan: planForSubscription(sub.status, meta?.plan),
						stripeSubscriptionId: sub.id as string,
					})
					.where(eq(workspace.stripeCustomerId, sub.customer as string));
				break;
			}
			case "customer.subscription.deleted": {
				const sub = event.data.object;
				// Subscription ended → back to no entitlement (blocked until they
				// re-subscribe). Paid-only: there is no free fallback tier.
				await d
					.update(workspace)
					.set({ plan: "none", stripeSubscriptionId: null })
					.where(eq(workspace.stripeCustomerId, sub.customer as string));
				break;
			}
			default:
				// Unhandled event types are acknowledged so Stripe stops retrying.
				break;
		}

		return c.json({ received: true });
	});
