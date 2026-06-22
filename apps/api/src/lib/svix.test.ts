import { describe, expect, it } from "vitest";

import { verifySvixSignature } from "./svix";

// Re-create a valid Svix signature the way Resend/Svix does, to drive the tests:
// base64(HMAC-SHA256(base64-decoded-key, `${id}.${ts}.${body}`)), header `v1,<sig>`.
async function signSvix(
	secret: string,
	id: string,
	ts: string,
	body: string,
): Promise<string> {
	const decoded = atob(secret.slice("whsec_".length));
	const keyBytes = new Uint8Array(decoded.length);
	for (let i = 0; i < decoded.length; i++) keyBytes[i] = decoded.charCodeAt(i);
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${id}.${ts}.${body}`),
	);
	let bin = "";
	const bytes = new Uint8Array(sig);
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return `v1,${btoa(bin)}`;
}

const SECRET = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
const ID = "msg_abc";
const BODY = JSON.stringify({
	to: ["reply+dev@example.com"],
	from: { address: "visitor@example.com" },
	text: "real reply",
});
const now = () => Math.floor(Date.now() / 1000);

describe("verifySvixSignature", () => {
	it("accepts a correctly signed, in-window payload", async () => {
		const ts = String(now());
		const signature = await signSvix(SECRET, ID, ts, BODY);
		expect(
			await verifySvixSignature(
				BODY,
				{ id: ID, timestamp: ts, signature },
				SECRET,
			),
		).toBe(true);
	});

	it("rejects a tampered body (forged reply with a stolen signature)", async () => {
		const ts = String(now());
		const signature = await signSvix(SECRET, ID, ts, BODY);
		expect(
			await verifySvixSignature(
				`${BODY} tampered`,
				{ id: ID, timestamp: ts, signature },
				SECRET,
			),
		).toBe(false);
	});

	it("rejects a signature made with a different secret", async () => {
		const ts = String(now());
		const signature = await signSvix(
			`whsec_${btoa("a-totally-different-key-000002!!")}`,
			ID,
			ts,
			BODY,
		);
		expect(
			await verifySvixSignature(
				BODY,
				{ id: ID, timestamp: ts, signature },
				SECRET,
			),
		).toBe(false);
	});

	it("rejects when no secret is configured (fail-closed)", async () => {
		const ts = String(now());
		const signature = await signSvix(SECRET, ID, ts, BODY);
		expect(
			await verifySvixSignature(
				BODY,
				{ id: ID, timestamp: ts, signature },
				undefined,
			),
		).toBe(false);
	});

	it("rejects missing svix headers", async () => {
		expect(
			await verifySvixSignature(
				BODY,
				{ id: null, timestamp: null, signature: null },
				SECRET,
			),
		).toBe(false);
	});

	it("rejects an out-of-tolerance timestamp (replay guard)", async () => {
		const oldTs = String(now() - 4_000);
		const signature = await signSvix(SECRET, ID, oldTs, BODY);
		expect(
			await verifySvixSignature(
				BODY,
				{ id: ID, timestamp: oldTs, signature },
				SECRET,
			),
		).toBe(false);
	});
});
