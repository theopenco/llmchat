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

// Real Resend inbound shape: an `{ type, data }` envelope, `from` an RFC-5322
// string, `to` an array of strings.
const FORGED = {
	type: "email.received",
	data: {
		to: ["reply+dev@example.com"],
		from: "Attacker <attacker@evil.com>",
		text: "forged reply injected into someone's conversation",
	},
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

	it("forwards contact@ mail to the stopgap team inboxes and acks with 200", async () => {
		// Mail to the contact address matches no conversation but must be copied
		// to the team and then ACKNOWLEDGED — a non-2xx makes Resend retry, and
		// every retry re-forwards a duplicate copy. RFC-5322 display-name form
		// and case differences must not defeat the trigger match.
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({ id: "email_1" }))),
			);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
			const body = JSON.stringify({
				type: "email.received",
				data: {
					to: ["Clanker Support <Contact@ClankerSupport.com>"],
					from: "WordPress.org <plugins@wordpress.org>",
					subject: "Your plugin review",
					text: "Hi, about your submission…",
					headers: {},
				},
			});
			const id = "msg_fwd";
			const ts = String(Math.floor(Date.now() / 1000));
			const signature = await signSvix(secret, id, ts, body);

			const res = await post(
				body,
				{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
				{
					RESEND_INBOUND_WEBHOOK_SECRET: secret,
					RESEND_API_KEY: "re_test_key",
					RESEND_FROM_EMAIL: "noreply@clankersupport.com",
				},
			);
			expect(res.status).toBe(200); // forward-only mail is acked, not retried

			const sends = fetchMock.mock.calls.filter(
				([url]) => url === "https://api.resend.com/emails",
			);
			const recipients = sends.map(
				([, init]) => JSON.parse((init as RequestInit).body as string).to,
			);
			expect(recipients).toEqual(
				expect.arrayContaining([
					"haythamchhilif@gmail.com",
					"contact@luca-steeb.com",
				]),
			);
			const payload = JSON.parse(
				(sends[0]![1] as RequestInit).body as string,
			) as { subject: string; reply_to: string };
			expect(payload.subject).toBe("Fwd: Your plugin review");
			expect(payload.reply_to).toBe("plugins@wordpress.org");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("still acks when Resend rejects one forward recipient", async () => {
		// A forward failure is logged, not fatal: the delivery is still acked
		// (retrying would duplicate the copy that DID send), and the second
		// recipient still gets its copy.
		const fetchMock = vi.fn().mockImplementation((_url, init) => {
			const to = JSON.parse((init as RequestInit).body as string).to as string;
			return to === "haythamchhilif@gmail.com"
				? Promise.resolve(new Response("boom", { status: 500 }))
				: Promise.resolve(new Response(JSON.stringify({ id: "email_2" })));
		});
		vi.stubGlobal("fetch", fetchMock);
		try {
			const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
			const body = JSON.stringify({
				type: "email.received",
				data: {
					to: ["contact@clankersupport.com"],
					from: "someone@example.com",
					subject: "hi",
					text: "hello",
					headers: {},
				},
			});
			const id = "msg_fwd_fail";
			const ts = String(Math.floor(Date.now() / 1000));
			const signature = await signSvix(secret, id, ts, body);

			const res = await post(
				body,
				{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
				{
					RESEND_INBOUND_WEBHOOK_SECRET: secret,
					RESEND_API_KEY: "re_test_key",
					RESEND_FROM_EMAIL: "noreply@clankersupport.com",
				},
			);
			expect(res.status).toBe(200);
			expect(
				fetchMock.mock.calls.filter(
					([url]) => url === "https://api.resend.com/emails",
				),
			).toHaveLength(2);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("still forwards and acks contact@ mail when threading fails (mixed recipients)", async () => {
		// Mail addressed to contact@ AND a reply+ address must forward and ack
		// with 200 even when the reply+ threading dead-ends (no matching
		// project here) — otherwise Resend retries and duplicates the forward.
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({ id: "email_4" }))),
			);
		vi.stubGlobal("fetch", fetchMock);
		try {
			vi.mocked(db).mockReturnValue({
				query: { project: { findFirst: async () => undefined } },
			} as unknown as ReturnType<typeof db>);
			const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
			const body = JSON.stringify({
				type: "email.received",
				data: {
					to: [
						"contact@clankersupport.com",
						"reply+nosuchproject@clankersupport.com",
					],
					from: "someone@example.com",
					subject: "hi",
					text: "hello",
					headers: {},
				},
			});
			const id = "msg_fwd_mixed";
			const ts = String(Math.floor(Date.now() / 1000));
			const signature = await signSvix(secret, id, ts, body);

			const res = await post(
				body,
				{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
				{
					RESEND_INBOUND_WEBHOOK_SECRET: secret,
					RESEND_API_KEY: "re_test_key",
					RESEND_FROM_EMAIL: "noreply@clankersupport.com",
				},
			);
			expect(res.status).toBe(200); // forwarded ⇒ acked despite the dead-end
			expect(
				fetchMock.mock.calls.filter(
					([url]) => url === "https://api.resend.com/emails",
				),
			).toHaveLength(2);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("does NOT forward mail addressed to other inbound addresses", async () => {
		// Only contact@clankersupport.com triggers the stopgap forward — a
		// visitor's reply+ conversation mail must not be copied to the team.
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({ id: "email_3" }))),
			);
		vi.stubGlobal("fetch", fetchMock);
		try {
			vi.mocked(db).mockReturnValue({
				query: { project: { findFirst: async () => undefined } },
			} as unknown as ReturnType<typeof db>);
			const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
			const body = JSON.stringify({
				type: "email.received",
				data: {
					to: ["reply+dev@clankersupport.com", "hello@clankersupport.com"],
					from: "visitor@example.com",
					subject: "re: my order",
					text: "following up",
					headers: {},
				},
			});
			const id = "msg_nofwd";
			const ts = String(Math.floor(Date.now() / 1000));
			const signature = await signSvix(secret, id, ts, body);

			const res = await post(
				body,
				{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
				{
					RESEND_INBOUND_WEBHOOK_SECRET: secret,
					RESEND_API_KEY: "re_test_key",
					RESEND_FROM_EMAIL: "noreply@clankersupport.com",
				},
			);
			expect(res.status).toBe(404); // proceeded to project lookup, no forward
			expect(
				fetchMock.mock.calls.filter(
					([url]) => url === "https://api.resend.com/emails",
				),
			).toHaveLength(0);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("does not crash on an envelope missing data.to — returns 400, not 500", async () => {
		// Regression: the handler used to read top-level `payload.to` and call
		// `.map` on it, throwing "Cannot read properties of undefined (reading
		// 'map')" against Resend's real `{ type, data }` envelope.
		const secret = `whsec_${btoa("inbound-webhook-signing-key-0001")}`;
		const body = JSON.stringify({ type: "email.received", data: {} });
		const id = "msg_noto";
		const ts = String(Math.floor(Date.now() / 1000));
		const signature = await signSvix(secret, id, ts, body);

		const res = await post(
			body,
			{ "svix-id": id, "svix-timestamp": ts, "svix-signature": signature },
			{ RESEND_INBOUND_WEBHOOK_SECRET: secret },
		);
		expect(res.status).toBe(400);
	});
});
