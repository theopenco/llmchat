import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { notifyBillingDrift } from "@/lib/discord";
import { StripeError, retrieveSubscription } from "@/lib/stripe";

import { runBillingReconcile } from "./billing-reconcile";

import type { Env } from "@/env";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/discord", () => ({ notifyBillingDrift: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe", async (orig) => ({
	...(await orig<typeof import("@/lib/stripe")>()),
	retrieveSubscription: vi.fn(),
}));

const ENV = {
	vars: {
		STRIPE_SECRET_KEY: "sk_test_fixture",
		STRIPE_PRICE_STARTER: "price_starter",
		STRIPE_PRICE_GROWTH: "price_growth",
		STRIPE_PRICE_SCALE: "price_scale",
	},
	DB: {},
} as unknown as Env;

interface Row {
	id: string;
	plan: string;
	stripeSubscriptionId: string | null;
}

/** Every `update(workspace).set(...)` payload the run issued, in order. */
function mockDb(rows: Row[]): Array<Record<string, unknown>> {
	const writes: Array<Record<string, unknown>> = [];
	const fake = {
		select: () => ({
			from: () => ({
				where: () => ({ limit: async () => rows }),
			}),
		}),
		update: () => ({
			set: (vals: Record<string, unknown>) => ({
				where: async () => {
					writes.push(vals);
					return [];
				},
			}),
		}),
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return writes;
}

const sub = (status: string, priceId?: string) => ({
	id: "sub_1",
	status,
	...(priceId ? { items: { data: [{ price: { id: priceId } }] } } : {}),
});

beforeEach(() => vi.clearAllMocks());

describe("runBillingReconcile", () => {
	it("skips entirely when Stripe isn't configured", async () => {
		mockDb([]);
		const env = { ...ENV, vars: {} } as unknown as Env;
		const res = await runBillingReconcile(env);
		expect(res.skipped).toBe(true);
		expect(retrieveSubscription).not.toHaveBeenCalled();
	});

	it("leaves a workspace whose Stripe tier already matches", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		]);
		vi.mocked(retrieveSubscription).mockResolvedValue(
			sub("active", "price_scale"),
		);
		const res = await runBillingReconcile(ENV);
		expect(res.checked).toBe(1);
		expect(res.corrections).toEqual([]);
		expect(writes).toEqual([]);
		expect(notifyBillingDrift).not.toHaveBeenCalled();
	});

	it("demotes a workspace whose subscription is gone (the missed deleted webhook)", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		]);
		vi.mocked(retrieveSubscription).mockRejectedValue(
			new StripeError(404, "{}", "No such subscription"),
		);
		const res = await runBillingReconcile(ENV);
		expect(res.corrections).toEqual([
			{ workspaceId: "ws_1", from: "scale", to: "none", reason: "missing" },
		]);
		// The dangling id is cleared so tomorrow's run doesn't re-probe a 404.
		expect(writes).toEqual([{ plan: "none", stripeSubscriptionId: null }]);
		expect(notifyBillingDrift).toHaveBeenCalledOnce();
	});

	it("demotes a workspace whose trial lapsed into a non-entitling status", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		]);
		vi.mocked(retrieveSubscription).mockResolvedValue(
			sub("past_due", "price_scale"),
		);
		const res = await runBillingReconcile(ENV);
		expect(res.corrections[0]).toMatchObject({
			to: "none",
			reason: "past_due",
		});
		// Still a live subscription in Stripe — keep the id.
		expect(writes).toEqual([{ plan: "none" }]);
	});

	it("corrects a tier that drifted from the price actually billed", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		]);
		vi.mocked(retrieveSubscription).mockResolvedValue(
			sub("active", "price_starter"),
		);
		const res = await runBillingReconcile(ENV);
		expect(res.corrections[0]).toMatchObject({ from: "scale", to: "starter" });
		expect(writes).toEqual([{ plan: "starter" }]);
	});

	it("never demotes on an unverifiable Stripe failure", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		]);
		vi.mocked(retrieveSubscription).mockRejectedValue(
			new StripeError(503, "{}", "Service unavailable"),
		);
		const res = await runBillingReconcile(ENV);
		expect(res.unverified).toBe(1);
		expect(res.corrections).toEqual([]);
		expect(writes).toEqual([]);
	});

	it("reports — but never auto-corrects — a paid plan with no subscription id", async () => {
		const writes = mockDb([
			{ id: "ws_1", plan: "growth", stripeSubscriptionId: null },
		]);
		const res = await runBillingReconcile(ENV);
		expect(res.unverified).toBe(1);
		expect(writes).toEqual([]);
		expect(retrieveSubscription).not.toHaveBeenCalled();
		expect(notifyBillingDrift).toHaveBeenCalledOnce();
	});
});
