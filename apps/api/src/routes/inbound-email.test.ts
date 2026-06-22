import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { inboundEmail } from "./inbound-email";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

/** Build a valid Svix signature header (same scheme verifySvixSignature checks). */
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

const FORGED = {
	to: ["reply+dev@example.com"],
	from: { address: "attacker@evil.com" },
	text: "forged reply injected into someone's conversation",
};

function post(
	body: string,
	headers: Record<string, string>,
	vars: Record<string, string> = {},
) {
	const env = { vars } as unknown as Parameters<typeof inboundEmail.request>[2];
	return inboundEmail.request(
		"/webhooks/inbound-email",
		{
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body,
		},
		env,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("inbound-email webhook — signature required (fail-closed)", () => {
	it("rejects an unsigned forged payload with 401 (the hole the audit found)", async () => {
		const res = await post(JSON.stringify(FORGED), {}, {});
		expect(res.status).toBe(401);
	});

	it("rejects bogus svix headers (401), even when a secret is configured", async () => {
		const res = await post(
			JSON.stringify(FORGED),
			{
				"svix-id": "msg_x",
				"svix-timestamp": String(Math.floor(Date.now() / 1000)),
				"svix-signature": "v1,not-a-real-signature",
			},
			{ RESEND_INBOUND_WEBHOOK_SECRET: `whsec_${btoa("k0001-len-padding!!")}` },
		);
		expect(res.status).toBe(401);
	});

	it("accepts a correctly signed payload — proceeds PAST auth (404 here: no matching project)", async () => {
		// db returns no project ⇒ the handler 404s AFTER the signature passes. A 404
		// (not 401) proves the signature was accepted and the body was parsed.
		vi.mocked(db).mockReturnValue({
			query: { project: { findFirst: async () => undefined } },
		} as unknown as ReturnType<typeof db>);

		const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
		const body = JSON.stringify(FORGED);
		const id = "msg_ok";
		const ts = String(Math.floor(Date.now() / 1000));
		const signature = await signSvix(secret, id, ts, body);

		const res = await post(
			body,
			{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
			{ RESEND_INBOUND_WEBHOOK_SECRET: secret },
		);
		expect(res.status).toBe(404);
	});
});
