// Svix-style webhook signature verification (Resend signs inbound-email webhooks
// with Svix). Distinct from the Stripe scheme in lib/stripe.ts: Svix signs
// `${id}.${timestamp}.${rawBody}` with a base64-decoded `whsec_`-prefixed key and
// emits BASE64 signatures in a space-separated `v1,<sig>` list. workerd-safe
// (crypto.subtle + atob/btoa only).

/** HMAC-SHA256 of `payload` with raw key bytes, returned base64 (Svix scheme). */
async function hmacSha256Base64(
	keyBytes: Uint8Array,
	payload: string,
): Promise<string> {
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
		new TextEncoder().encode(payload),
	);
	let bin = "";
	const bytes = new Uint8Array(sig);
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin);
}

/** Constant-time string compare — no early exit on the first differing byte. */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export interface SvixHeaders {
	id: string | null;
	timestamp: string | null;
	signature: string | null;
}

/**
 * Verify a Svix-style webhook signature (Resend inbound). Returns true ONLY when
 * the signature matches and the timestamp is within tolerance (replay guard).
 * Fails closed: a missing secret/header or malformed key returns false.
 *  - `secret`: `whsec_<base64>` (the part after the prefix is the base64 key)
 *  - signed content: `${id}.${timestamp}.${rawBody}` (rawBody read before any parse)
 *  - `svix-signature`: space-separated `v1,<base64>` entries
 */
export async function verifySvixSignature(
	rawBody: string,
	headers: SvixHeaders,
	secret: string | undefined,
	opts: { toleranceSec?: number; nowMs?: number } = {},
): Promise<boolean> {
	const { id, timestamp, signature } = headers;
	if (!secret || !id || !timestamp || !signature) return false;

	const toleranceSec = opts.toleranceSec ?? 300;
	const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
	const ts = Number(timestamp);
	if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec)
		return false;

	const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
	let keyBytes: Uint8Array;
	try {
		const decoded = atob(keyB64);
		keyBytes = new Uint8Array(decoded.length);
		for (let i = 0; i < decoded.length; i++)
			keyBytes[i] = decoded.charCodeAt(i);
	} catch {
		return false;
	}

	const expected = await hmacSha256Base64(
		keyBytes,
		`${id}.${timestamp}.${rawBody}`,
	);
	// Header is a space-separated list of `version,signature` (e.g. "v1,abc v1,def").
	const provided = signature.split(" ").map((tok) => {
		const comma = tok.indexOf(",");
		return comma === -1 ? tok : tok.slice(comma + 1);
	});
	return provided.some((sig) => timingSafeEqual(sig, expected));
}
