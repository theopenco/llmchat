import { describe, expect, it } from "vitest";

import {
	basePriceToPlan,
	planForPriceIds,
	planForSubscription,
} from "./billing-config";

import type { AppContext } from "@/env";

const VARS = {
	STRIPE_PRICE_STARTER: "price_starter",
	STRIPE_PRICE_GROWTH: "price_growth",
	STRIPE_PRICE_SCALE: "price_scale",
	STRIPE_PRICE_STARTER_ANNUAL: "price_starter_yr",
	STRIPE_PRICE_SCALE_ANNUAL: "price_scale_yr",
	STRIPE_PRICE_GROWTH_OVERAGE: "price_growth_overage",
	STRIPE_PRICE_SCALE_OVERAGE: "price_scale_overage",
} as unknown as AppContext["Bindings"]["vars"];

const sub = (over: Record<string, unknown> = {}) => ({
	status: "active",
	metadata: { workspaceId: "ws_1", plan: "scale" },
	...over,
});

const items = (...ids: string[]) => ({
	data: ids.map((id) => ({ price: { id } })),
});

describe("basePriceToPlan", () => {
	it("maps both cadences of every configured base price", () => {
		const map = basePriceToPlan(VARS);
		expect(map.get("price_starter")).toBe("starter");
		expect(map.get("price_starter_yr")).toBe("starter");
		expect(map.get("price_scale_yr")).toBe("scale");
	});

	it("omits overage prices — the base price names the tier", () => {
		const map = basePriceToPlan(VARS);
		expect(map.has("price_growth_overage")).toBe(false);
		expect(map.has("price_scale_overage")).toBe(false);
	});

	it("omits tiers with no configured price", () => {
		expect(basePriceToPlan({} as typeof VARS).size).toBe(0);
	});
});

describe("planForPriceIds", () => {
	it("resolves the first recognized base price", () => {
		expect(planForPriceIds(VARS, ["price_growth"])).toBe("growth");
	});

	it("skips an overage line to find the base price", () => {
		expect(planForPriceIds(VARS, ["price_scale_overage", "price_scale"])).toBe(
			"scale",
		);
	});

	it("is undefined when nothing matches", () => {
		expect(planForPriceIds(VARS, ["price_who_knows"])).toBeUndefined();
		expect(planForPriceIds(VARS, [])).toBeUndefined();
	});
});

describe("planForSubscription", () => {
	it("trusts the PRICE over a stale metadata stamp (the portal-downgrade hole)", () => {
		// Stamped "scale" at Checkout, since downgraded to Starter in the Stripe
		// Billing Portal. Stripe never rewrites metadata, so the stamp lies.
		const plan = planForSubscription(
			VARS,
			sub({ items: items("price_starter") }),
		);
		expect(plan).toBe("starter");
	});

	it("also catches a portal UPGRADE the stamp missed", () => {
		const plan = planForSubscription(
			VARS,
			sub({
				metadata: { plan: "starter" },
				items: items("price_scale", "price_scale_overage"),
			}),
		);
		expect(plan).toBe("scale");
	});

	it("falls back to the stamp when the price is unrecognized", () => {
		// A legacy or hand-made price in Stripe must not drop a paying customer.
		expect(
			planForSubscription(VARS, sub({ items: items("price_legacy") })),
		).toBe("scale");
	});

	it("falls back to the stamp when the payload carries no items at all", () => {
		expect(planForSubscription(VARS, sub())).toBe("scale");
	});

	it("rejects a bad stamp to none rather than trusting it", () => {
		expect(
			planForSubscription(VARS, sub({ metadata: { plan: "enterprise" } })),
		).toBe("none");
		expect(planForSubscription(VARS, sub({ metadata: null }))).toBe("none");
	});

	it("is none for any non-entitling status, whatever the price says", () => {
		for (const status of [
			"canceled",
			"past_due",
			"unpaid",
			"incomplete",
			"paused",
		]) {
			expect(
				planForSubscription(VARS, sub({ status, items: items("price_scale") })),
			).toBe("none");
		}
	});

	it("treats trialing as entitled (the free trial)", () => {
		expect(
			planForSubscription(
				VARS,
				sub({ status: "trialing", items: items("price_scale") }),
			),
		).toBe("scale");
	});
});
