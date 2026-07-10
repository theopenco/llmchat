// Possession-proof for return filing (issue #131): before create_return files
// anything, the visitor must prove control of the mailbox on the order by
// echoing back a one-time code we email to that address. Knowing an order
// number + email (both of which appear together on packing slips, forwarded
// receipts, and shared screenshots) is identification, not authentication —
// filing a return changes order state, so it gets the stronger check.
//
// Shape mirrors lib/kv.ts: STATE get/set with value-tracked expiry (the
// deployed binding exposes no put/expirationTtl). All outcomes are explicit
// strings so callers can map them to honest visitor-facing copy. Every path
// that would open the write gate FAILS CLOSED on a STATE outage — a possession
// proof that silently passes during an outage is no proof at all.

import type { Env } from "@/env";

import { sendEmail, escapeHtml } from "./email";

/** How long an emailed code stays redeemable. */
const CODE_TTL_SECONDS = 600; // 10 min
/** How long a successful verification authorizes filings for that order. */
const VERIFIED_TTL_SECONDS = 1800; // 30 min
/** Wrong-code attempts before the code is burned (locked). Defense-in-depth,
 * NOT the global brute-force bound — that is the fail-closed per-project action
 * limiter gating verify_return_code (see integration-tools.ts). STATE has no
 * atomic ops (lib/kv.ts), so concurrent confirms can lost-update this counter
 * and overshoot the lockout by the in-flight width; the action limiter is what
 * keeps total guesses bounded regardless. */
const MAX_ATTEMPTS = 5;
/** Successful code sends per conversation per window — a mailbox-spam limiter,
 * NOT a brute-force bound (clientId is attacker-chosen, so this resets on a new
 * conversation; the per-project action limiter is the anti-rotation bound). */
const SEND_MAX = 3;
const SEND_WINDOW_SECONDS = 3600;

export type StartOutcome = "sent" | "limited" | "unavailable";
export type ConfirmOutcome =
	| "verified"
	| "invalid"
	| "expired"
	| "locked"
	| "unavailable";

interface CodeRecord {
	/** SHA-256 hex of the code — the plaintext never touches STATE. */
	hash: string;
	/** The address the code was emailed to; the verified flag is bound to it. */
	email: string;
	attempts: number;
	expiresAt: number; // unix seconds
}

interface VerifiedRecord {
	email: string;
	expiresAt: number;
}

interface SendBucket {
	count: number;
	resetAt: number;
}

/** One key per (conversation, order): a visitor verifies each order once. */
const codeKey = (conversationId: string, orderKey: string) =>
	`overif:${conversationId}:${orderKey}`;
const verifiedKey = (conversationId: string, orderKey: string) =>
	`overif-ok:${conversationId}:${orderKey}`;
const sendKey = (conversationId: string) => `overif-send:${conversationId}`;

/** Normalize an order name/number so "#1001", "1001", " 1001 " collide. */
export function normalizeOrderKey(orderNumber: string): string {
	return orderNumber.trim().replace(/^#/, "").toLowerCase();
}

/** 6-digit code from the CSPRNG. Rejection-sampled so every code is uniform
 * (a plain modulo would bias the low range). */
export function generateVerificationCode(): string {
	const buf = new Uint32Array(1);
	// 4_294_000_000 is the largest multiple of 1e6 below 2^32 (4_294_967_296);
	// resampling values at/above it makes `% 1_000_000` exactly uniform (no
	// modulo bias). The bound MUST remain a multiple of 1e6 — do not "round" it.
	for (;;) {
		crypto.getRandomValues(buf);
		const v = buf[0]!;
		if (v < 4_294_000_000) {
			return String(v % 1_000_000).padStart(6, "0");
		}
	}
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Constant-time compare of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

const now = () => Math.floor(Date.now() / 1000);

/**
 * Email a fresh one-time code to `email` (the address ALREADY verified against
 * the order by the caller — this module never picks recipients) and store its
 * hash for (conversation, order). Re-issuing replaces any prior code, so "send
 * me a new one" always invalidates the old. Send-rate is capped per
 * conversation and FAILS CLOSED, as does the STATE write: on any fault the
 * caller must treat verification as not started.
 */
export async function startReturnVerification(
	env: Env,
	opts: {
		conversationId: string;
		orderKey: string;
		email: string;
		/** Merchant-facing name for the email copy. */
		projectName: string;
	},
	send: typeof sendEmail = sendEmail,
): Promise<StartOutcome> {
	const at = now();
	try {
		// Read the send window (same bucket shape as lib/kv.ts). We only COUNT a
		// send once its email actually goes out (below), so a Resend outage — which
		// throws before the increment — never burns a legit visitor's budget and
		// then falsely tells them "too many codes".
		const rawBucket = await env.STATE.get(sendKey(opts.conversationId));
		const bucket: SendBucket = { count: 0, resetAt: at + SEND_WINDOW_SECONDS };
		if (rawBucket) {
			try {
				const parsed = JSON.parse(rawBucket) as SendBucket;
				if (parsed.resetAt > at) {
					bucket.count = parsed.count;
					bucket.resetAt = parsed.resetAt;
				}
			} catch {
				// malformed — fresh window
			}
		}
		if (bucket.count >= SEND_MAX) return "limited";

		const code = generateVerificationCode();
		const record: CodeRecord = {
			hash: await sha256Hex(code),
			email: opts.email,
			attempts: 0,
			expiresAt: at + CODE_TTL_SECONDS,
		};
		// Store the hash BEFORE sending: a stored-but-unsent code is a dead code
		// (visitor asks again), a sent-but-unstored code is unredeemable support
		// pain. Prefer the recoverable failure.
		await env.STATE.set(
			codeKey(opts.conversationId, opts.orderKey),
			JSON.stringify(record),
		);

		const safeName = escapeHtml(opts.projectName);
		await send(env, {
			to: opts.email,
			subject: `${opts.projectName} — your return verification code`,
			html: [
				`<p>Someone asked to file a return on your order in a ${safeName} support chat.</p>`,
				`<p style="font-size:28px;font-weight:bold;letter-spacing:4px;font-family:monospace">${code}</p>`,
				`<p>Enter this code in the chat to confirm. It expires in 10 minutes.</p>`,
				`<p>If this wasn't you, ignore this email — nothing is filed without the code.</p>`,
			].join("\n"),
			text: `Your ${opts.projectName} return verification code is ${code}. It expires in 10 minutes. If this wasn't you, ignore this email — nothing is filed without the code.`,
		});
		// Count the send only now that the email actually went out.
		bucket.count += 1;
		await env.STATE.set(sendKey(opts.conversationId), JSON.stringify(bucket));
		return "sent";
	} catch (err) {
		console.error("order-verification: start failed", err);
		return "unavailable";
	}
}

/**
 * Redeem a visitor-supplied code. On success the (conversation, order, email)
 * triple is marked verified for VERIFIED_TTL_SECONDS and the code is burned.
 * Wrong codes count toward MAX_ATTEMPTS and then lock; expiry, lockout, and
 * STATE faults all keep the gate shut.
 */
export async function confirmReturnVerification(
	env: Env,
	opts: { conversationId: string; orderKey: string; code: string },
): Promise<ConfirmOutcome> {
	const key = codeKey(opts.conversationId, opts.orderKey);
	try {
		const raw = await env.STATE.get(key);
		if (!raw) return "expired";
		let record: CodeRecord;
		try {
			record = JSON.parse(raw) as CodeRecord;
		} catch {
			return "expired";
		}
		if (record.expiresAt <= now()) return "expired";
		if (record.attempts >= MAX_ATTEMPTS) return "locked";

		// Count the attempt BEFORE comparing, so a crash between compare and
		// write can't grant unlimited sequential guesses. Concurrent confirms can
		// still lost-update this counter (STATE is non-atomic — see lib/kv.ts) and
		// overshoot MAX_ATTEMPTS by the in-flight width; that is tolerated because
		// verify_return_code is gated by the fail-closed per-project action limiter
		// which is the actual global brute-force bound (this lockout is defense-in-
		// depth, not the sole control).
		record.attempts += 1;
		await env.STATE.set(key, JSON.stringify(record));

		const supplied = await sha256Hex(opts.code.trim());
		if (!timingSafeEqualHex(supplied, record.hash)) {
			return record.attempts >= MAX_ATTEMPTS ? "locked" : "invalid";
		}

		// Ordering is deliberate: write the verified flag FIRST, then burn the
		// code. If the burn write faults we return "unavailable" but the flag is
		// already durable, so the visitor's retry files correctly — a benign
		// over-report. The inverse order could burn a code while leaving no flag,
		// stranding a visitor who genuinely verified. Do not swap these.
		const verified: VerifiedRecord = {
			email: record.email,
			expiresAt: now() + VERIFIED_TTL_SECONDS,
		};
		await env.STATE.set(
			verifiedKey(opts.conversationId, opts.orderKey),
			JSON.stringify(verified),
		);
		// Burn the code — a redeemed code must not be redeemable again.
		await env.STATE.set(
			key,
			JSON.stringify({ ...record, expiresAt: 0 } satisfies CodeRecord),
		);
		return "verified";
	} catch (err) {
		console.error("order-verification: confirm failed", err);
		return "unavailable";
	}
}

/**
 * Is this (conversation, order) verified for this email? The email must match
 * the one the code was sent to — a verified flag earned for one address never
 * authorizes filings claimed under another. FAILS CLOSED on STATE faults.
 */
export async function isReturnVerified(
	env: Env,
	opts: { conversationId: string; orderKey: string; email: string },
): Promise<boolean> {
	try {
		const raw = await env.STATE.get(
			verifiedKey(opts.conversationId, opts.orderKey),
		);
		if (!raw) return false;
		const record = JSON.parse(raw) as VerifiedRecord;
		return (
			record.expiresAt > now() &&
			record.email.toLowerCase() === opts.email.trim().toLowerCase()
		);
	} catch (err) {
		console.error("order-verification: check failed", err);
		return false;
	}
}
