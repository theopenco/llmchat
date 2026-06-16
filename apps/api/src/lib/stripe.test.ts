import { describe, expect, it } from "vitest";

import { formEncode, hmacSha256Hex, verifyStripeSignature } from "./stripe";

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
