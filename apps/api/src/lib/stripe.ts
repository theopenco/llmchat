// Stripe REST client for workerd. We deliberately do NOT use the Stripe Node
// SDK — it pulls Node built-ins that don't bundle on workerd, and the api is
// the one app that always deploys cleanly. Everything here is plain `fetch`
// with form-encoded bodies + Web Crypto signature verification.

const STRIPE_API = "https://api.stripe.com/v1";

export class StripeError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
		message: string,
	) {
		super(`Stripe ${status}: ${message}`);
		this.name = "StripeError";
	}
}

/**
 * Form-encode a (possibly nested) object the way Stripe's API expects:
 * arrays and objects become bracketed keys, e.g.
 *   { line_items: [{ price: "p", quantity: 1 }] }
 *     -> line_items[0][price]=p&line_items[0][quantity]=1
 *   { subscription_data: { metadata: { workspaceId: "w" } } }
 *     -> subscription_data[metadata][workspaceId]=w
 * null/undefined values are omitted.
 */
export function formEncode(obj: Record<string, unknown>): string {
	const parts: string[] = [];
	const walk = (key: string, val: unknown) => {
		if (val === undefined || val === null) return;
		if (Array.isArray(val)) {
			val.forEach((v, i) => walk(`${key}[${i}]`, v));
		} else if (typeof val === "object") {
			for (const [k, v] of Object.entries(val)) walk(`${key}[${k}]`, v);
		} else {
			parts.push(
				`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`,
			);
		}
	};
	for (const [k, v] of Object.entries(obj)) walk(k, v);
	return parts.join("&");
}

async function stripePost<T>(
	secretKey: string,
	path: string,
	params: Record<string, unknown>,
): Promise<T> {
	const res = await fetch(`${STRIPE_API}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: formEncode(params),
	});
	const text = await res.text();
	if (!res.ok) {
		// Preserve the raw body for server-side diagnosis; surface only the
		// human-readable message (when Stripe sent JSON) in the thrown error.
		let message = "request failed";
		try {
			message =
				(JSON.parse(text) as { error?: { message?: string } })?.error
					?.message ?? message;
		} catch {
			// Non-JSON error body — keep the default message; raw text is on .body.
		}
		throw new StripeError(res.status, text, message);
	}
	return JSON.parse(text) as T;
}

export interface StripeCustomer {
	id: string;
}
export interface StripeSession {
	id: string;
	url: string;
}

export function createCustomer(
	secretKey: string,
	args: { email?: string; metadata?: Record<string, string> },
): Promise<StripeCustomer> {
	return stripePost<StripeCustomer>(secretKey, "/customers", {
		email: args.email,
		metadata: args.metadata,
	});
}

export function createCheckoutSession(
	secretKey: string,
	args: {
		customer: string;
		/** The flat base subscription price for the chosen tier. */
		priceId: string;
		/** Optional metered overage price (Growth/Scale). A metered line item
		 * carries no quantity — Stripe bills it from reported meter events. */
		overagePriceId?: string;
		/** The plan being purchased — stamped on the subscription so the webhook
		 * can map it back to a tier without re-deriving it from the price id. */
		plan: string;
		workspaceId: string;
		successUrl: string;
		cancelUrl: string;
	},
): Promise<StripeSession> {
	const lineItems: Array<Record<string, unknown>> = [
		{ price: args.priceId, quantity: 1 },
	];
	// Metered prices must NOT include a quantity; usage comes from meter events.
	if (args.overagePriceId) lineItems.push({ price: args.overagePriceId });

	return stripePost<StripeSession>(secretKey, "/checkout/sessions", {
		mode: "subscription",
		customer: args.customer,
		line_items: lineItems,
		// Paid-only: always collect a card, never offer a trial.
		payment_method_collection: "always",
		// Map the session AND the resulting subscription back to the workspace +
		// purchased tier, so the webhook needs no price→tier lookup. Stamped in
		// both places: session metadata is read on checkout.session.completed,
		// subscription metadata on later customer.subscription.* events.
		client_reference_id: args.workspaceId,
		metadata: { workspaceId: args.workspaceId, plan: args.plan },
		subscription_data: {
			metadata: { workspaceId: args.workspaceId, plan: args.plan },
		},
		success_url: args.successUrl,
		cancel_url: args.cancelUrl,
	});
}

/**
 * Report one usage increment to a Stripe Billing Meter (the current Meters API,
 * not the deprecated subscription-item usage records). Stripe aggregates events
 * by customer and applies the metered price's tiering — including the
 * first-N-free included quota — so we report EVERY billable response and let
 * Stripe own the billing math. `value` defaults to 1 (one response).
 *
 * Best-effort by design: callers run this inside `waitUntil` and ignore the
 * result, so a meter hiccup never blocks or fails a live response. We still
 * surface non-2xx via the thrown StripeError for logging at the call site.
 */
export function reportMeterEvent(
	secretKey: string,
	args: {
		eventName: string;
		customerId: string;
		value?: number;
		/** Idempotency key so a retried report isn't double-counted. */
		identifier?: string;
	},
): Promise<{ identifier?: string }> {
	return stripePost(secretKey, "/billing/meter_events", {
		event_name: args.eventName,
		identifier: args.identifier,
		payload: {
			stripe_customer_id: args.customerId,
			value: String(args.value ?? 1),
		},
	});
}

export function createPortalSession(
	secretKey: string,
	args: { customer: string; returnUrl: string },
): Promise<StripeSession> {
	return stripePost<StripeSession>(secretKey, "/billing_portal/sessions", {
		customer: args.customer,
		return_url: args.returnUrl,
	});
}

/** HMAC-SHA256 of `payload` keyed by `secret`, lowercase hex. */
export async function hmacSha256Hex(
	secret: string,
	payload: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	return Array.from(new Uint8Array(sig), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}

/** Constant-time hex string comparison. Avoids leaking match length via early
 * exit; `===` would short-circuit on the first differing byte. */
function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/**
 * Verify a Stripe webhook signature per Stripe's scheme:
 *  - header is `t=<unix>,v1=<hex>[,v1=<hex>...]`
 *  - signed payload is `${t}.${rawBody}` (the raw bytes Stripe signed)
 *  - HMAC-SHA256 hex with the endpoint secret, compared constant-time
 *  - reject if the timestamp is older than `toleranceSec` (replay protection)
 *
 * `rawBody` MUST be the exact request body string, read before any JSON parse.
 */
export async function verifyStripeSignature(
	rawBody: string,
	sigHeader: string | null,
	secret: string,
	opts: { toleranceSec?: number; nowMs?: number } = {},
): Promise<boolean> {
	if (!sigHeader || !secret) return false;
	const toleranceSec = opts.toleranceSec ?? 300;
	const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);

	let t: string | undefined;
	const v1: string[] = [];
	for (const part of sigHeader.split(",")) {
		const idx = part.indexOf("=");
		if (idx === -1) continue;
		const k = part.slice(0, idx).trim();
		const v = part.slice(idx + 1).trim();
		if (k === "t") t = v;
		else if (k === "v1" && v) v1.push(v);
	}
	if (!t || v1.length === 0) return false;

	const ts = Number(t);
	if (!Number.isFinite(ts)) return false;
	if (nowSec - ts > toleranceSec) return false;

	const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
	return v1.some((sig) => timingSafeEqualHex(sig, expected));
}
