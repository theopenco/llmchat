import { Hono } from "hono";

import { db } from "@/lib/db";
import {
	createCheckoutSession,
	createCustomer,
	createPortalSession,
	verifyStripeSignature,
} from "@/lib/stripe";
import { requireOwner, requireSession } from "@/middleware/session";

import { eq, workspace } from "@llmchat/db";

import type { AppContext } from "@/env";

const billingPage = (dashboardUrl: string, query = "") =>
	`${dashboardUrl}/settings/billing${query}`;

export const billing = new Hono<AppContext>()
	// Start a Pro subscription Checkout. Owner-only. Reuses the workspace's
	// Stripe customer if it has one, else creates and stores it (so retries
	// never create duplicate customers).
	.post("/billing/checkout", requireSession, requireOwner, async (c) => {
		const workspaceId = c.get("workspaceId");
		const userId = c.get("userId");
		const { STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, DASHBOARD_URL } =
			c.env.vars;

		const ws = await db(c.env).query.workspace.findFirst({
			where: (w, { eq: e }) => e(w.id, workspaceId),
		});
		if (!ws) return c.json({ error: "workspace not found" }, 404);

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
			priceId: STRIPE_PRO_PRICE_ID,
			workspaceId,
			successUrl: billingPage(DASHBOARD_URL, "?status=success"),
			cancelUrl: billingPage(DASHBOARD_URL, "?status=cancel"),
		});
		return c.json({ url: session.url });
	})
	// Open the Stripe Billing Portal so the owner can manage/cancel. Owner-only.
	.post("/billing/portal", requireSession, requireOwner, async (c) => {
		const workspaceId = c.get("workspaceId");
		const { STRIPE_SECRET_KEY, DASHBOARD_URL } = c.env.vars;

		const ws = await db(c.env).query.workspace.findFirst({
			where: (w, { eq: e }) => e(w.id, workspaceId),
		});
		if (!ws?.stripeCustomerId) {
			return c.json({ error: "no billing customer" }, 400);
		}

		const session = await createPortalSession(STRIPE_SECRET_KEY, {
			customer: ws.stripeCustomerId,
			returnUrl: billingPage(DASHBOARD_URL),
		});
		return c.json({ url: session.url });
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
				const workspaceId =
					(s.client_reference_id as string | undefined) ??
					(s.metadata as Record<string, string> | undefined)?.workspaceId;
				if (workspaceId) {
					await d
						.update(workspace)
						.set({
							stripeCustomerId: (s.customer as string) ?? undefined,
							stripeSubscriptionId: (s.subscription as string) ?? undefined,
							plan: "pro",
						})
						.where(eq(workspace.id, workspaceId));
				}
				break;
			}
			case "customer.subscription.updated": {
				const sub = event.data.object;
				const active = sub.status === "active" || sub.status === "trialing";
				await d
					.update(workspace)
					.set({
						plan: active ? "pro" : "free",
						stripeSubscriptionId: sub.id as string,
					})
					.where(eq(workspace.stripeCustomerId, sub.customer as string));
				break;
			}
			case "customer.subscription.deleted": {
				const sub = event.data.object;
				await d
					.update(workspace)
					.set({ plan: "free", stripeSubscriptionId: null })
					.where(eq(workspace.stripeCustomerId, sub.customer as string));
				break;
			}
			default:
				// Unhandled event types are acknowledged so Stripe stops retrying.
				break;
		}

		return c.json({ received: true });
	});
