import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createCheckoutSession,
	formEncode,
	hmacSha256Hex,
	reportMeterEvent,
	verifyStripeSignature,
} from "./stripe";

const SECRET = "whsec_test_fixture_secret";

/** Build a Stripe-Signature header the way Stripe does, for a given body+time. */
async function signHeader(
	body: string,
	tSec: number,
	secret = SECRET,
): Promise<string> {
	const v1 = await hmacSha256Hex(secret, `${tSec}.${body}`);
	return `t=${tSec},v1=${v1}`;
}

describe("formEncode", () => {
	it("encodes nested arrays and objects with bracketed keys", () => {
		const out = formEncode({
			mode: "subscription",
			"line_items[0][price]": "price_123",
			subscription_data: { metadata: { workspaceId: "ws_1" } },
			metadata: { workspaceId: "ws_1" },
		});
		expect(out).toContain("mode=subscription");
		expect(out).toContain("line_items%5B0%5D%5Bprice%5D=price_123");
		expect(out).toContain(
			"subscription_data%5Bmetadata%5D%5BworkspaceId%5D=ws_1",
		);
		expect(out).toContain("metadata%5BworkspaceId%5D=ws_1");
	});

	it("omits null/undefined values", () => {
		expect(formEncode({ a: "1", b: null, c: undefined })).toBe("a=1");
	});
});

describe("createCheckoutSession (request shape)", () => {
	afterEach(() => vi.unstubAllGlobals());

	function captureFetch() {
		const calls: { url: string; body: string }[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init: RequestInit) => {
				calls.push({ url, body: String(init.body) });
				return new Response(JSON.stringify({ id: "cs", url: "https://co" }), {
					status: 200,
				});
			}),
		);
		return calls;
	}

	it("adds the metered overage price as a quantity-less line item", async () => {
		const calls = captureFetch();
		await createCheckoutSession("sk", {
			customer: "cus_1",
			priceId: "price_base",
			overagePriceId: "price_overage",
			plan: "growth",
			workspaceId: "ws_1",
			successUrl: "https://s",
			cancelUrl: "https://c",
		});
		const body = calls[0]!.body;
		expect(body).toContain("line_items%5B0%5D%5Bprice%5D=price_base");
		expect(body).toContain("line_items%5B0%5D%5Bquantity%5D=1");
		expect(body).toContain("line_items%5B1%5D%5Bprice%5D=price_overage");
		// The metered line item must NOT carry a quantity.
		expect(body).not.toContain("line_items%5B1%5D%5Bquantity%5D");
		// Card upfront; plan stamped for the webhook. No trial unless asked for.
		expect(body).toContain("payment_method_collection=always");
		expect(body).toContain("metadata%5Bplan%5D=growth");
		expect(body).toContain("subscription_data%5Bmetadata%5D%5Bplan%5D=growth");
		expect(body).not.toContain("trial");
	});

	it("encodes the free trial as subscription_data[trial_period_days], card still required", async () => {
		const calls = captureFetch();
		await createCheckoutSession("sk", {
			customer: "cus_1",
			priceId: "price_base",
			plan: "starter",
			trialPeriodDays: 7,
			workspaceId: "ws_1",
			successUrl: "https://s",
			cancelUrl: "https://c",
		});
		const body = calls[0]!.body;
		expect(body).toContain("subscription_data%5Btrial_period_days%5D=7");
		// The trial must not relax card collection — the card converts the trial.
		expect(body).toContain("payment_method_collection=always");
	});

	it("omits the overage line item when no overage price is given (Starter)", async () => {
		const calls = captureFetch();
		await createCheckoutSession("sk", {
			customer: "cus_1",
			priceId: "price_starter",
			plan: "starter",
			workspaceId: "ws_1",
			successUrl: "https://s",
			cancelUrl: "https://c",
		});
		expect(calls[0]!.body).not.toContain("line_items%5B1%5D");
	});
});

describe("reportMeterEvent (request shape)", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("POSTs a meter event keyed by customer with value 1 by default", async () => {
		const calls: { url: string; body: string }[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string, init: RequestInit) => {
				calls.push({ url, body: String(init.body) });
				return new Response(JSON.stringify({ identifier: "id" }), {
					status: 200,
				});
			}),
		);
		await reportMeterEvent("sk", {
			eventName: "clanker_response",
			customerId: "cus_42",
			identifier: "evt_abc",
		});
		expect(calls[0]!.url).toBe(
			"https://api.stripe.com/v1/billing/meter_events",
		);
		const body = calls[0]!.body;
		expect(body).toContain("event_name=clanker_response");
		expect(body).toContain("identifier=evt_abc");
		expect(body).toContain("payload%5Bstripe_customer_id%5D=cus_42");
		expect(body).toContain("payload%5Bvalue%5D=1");
	});
});

describe("verifyStripeSignature", () => {
	const body = JSON.stringify({
		id: "evt_1",
		type: "checkout.session.completed",
	});
	const now = 1_900_000_000_000; // fixed clock (ms)
	const t = Math.floor(now / 1000);

	it("accepts a correctly signed, fresh payload", async () => {
		const header = await signHeader(body, t);
		expect(
			await verifyStripeSignature(body, header, SECRET, { nowMs: now }),
		).toBe(true);
	});

	it("rejects a tampered body (signature no longer matches)", async () => {
		const header = await signHeader(body, t);
		const tampered = body.replace("evt_1", "evt_evil");
		expect(
			await verifyStripeSignature(tampered, header, SECRET, { nowMs: now }),
		).toBe(false);
	});

	it("rejects a missing or malformed signature header", async () => {
		expect(await verifyStripeSignature(body, null, SECRET)).toBe(false);
		expect(await verifyStripeSignature(body, "garbage", SECRET)).toBe(false);
		expect(await verifyStripeSignature(body, `t=${t}`, SECRET)).toBe(false);
	});

	it("rejects a signature made with the wrong secret", async () => {
		const header = await signHeader(body, t, "whsec_attacker");
		expect(
			await verifyStripeSignature(body, header, SECRET, { nowMs: now }),
		).toBe(false);
	});

	it("rejects a stale timestamp beyond the 300s tolerance (replay)", async () => {
		const stale = t - 301;
		const header = await signHeader(body, stale);
		expect(
			await verifyStripeSignature(body, header, SECRET, { nowMs: now }),
		).toBe(false);
	});

	it("accepts multiple v1 signatures if any matches", async () => {
		const good = await hmacSha256Hex(SECRET, `${t}.${body}`);
		const header = `t=${t},v1=deadbeef,v1=${good}`;
		expect(
			await verifyStripeSignature(body, header, SECRET, { nowMs: now }),
		).toBe(true);
	});
});
