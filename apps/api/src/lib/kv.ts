import type { Env } from "@/env";

interface RateBucket {
	count: number;
	// unix seconds; the window is considered expired once now passes this.
	resetAt: number;
}

interface RateLimitOptions {
	/**
	 * Behaviour when the STATE store is unavailable. Default `false` (fail OPEN):
	 * defense-in-depth limiters on the PUBLIC widget must not take the embed down
	 * with the store — PR1's per-message spend caps already bound outage cost.
	 * Pass `true` (fail CLOSED) for security-sensitive callers, where allowing
	 * unbounded requests during an outage is the worse risk.
	 */
	failClosed?: boolean;
}

// Fixed-window rate limiter backed by the Ploy `state:` binding. We only use
// `get`/`set` (not `put` + `expirationTtl`) because the deployed state binding
// doesn't expose `put`, and expiry is tracked in the stored value instead.
//
// Atomicity: this is a read-modify-write, so heavy concurrency on one key can
// overshoot `max` (a lost update undercounts the window). An atomic increment
// via `STATE.update({ $inc })` was investigated but doesn't compose — the bucket
// is stored as a JSON *string* via `set`, while `$inc` targets structured
// document fields, and the deployed binding's document semantics are
// undocumented (same caveat as the missing `put`). Rather than ship a fragile
// atomic path, overshoot is left bounded by in-flight concurrency (the window +
// `max` still cap the total) and the security lever is `failClosed`.
export async function rateLimit(
	env: Env,
	key: string,
	max: number,
	windowSeconds: number,
	opts: RateLimitOptions = {},
): Promise<{ ok: boolean; remaining: number }> {
	const cacheKey = `ratelimit:${key}`;
	const now = Math.floor(Date.now() / 1000);

	try {
		let bucket: RateBucket = { count: 0, resetAt: now + windowSeconds };
		const raw = await env.STATE.get(cacheKey);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as RateBucket;
				// Only carry over a window that hasn't elapsed yet.
				if (parsed.resetAt > now) {
					bucket = parsed;
				}
			} catch {
				// Malformed entry — treat as a fresh window.
			}
		}

		if (bucket.count >= max) {
			return { ok: false, remaining: 0 };
		}

		bucket.count += 1;
		await env.STATE.set(cacheKey, JSON.stringify(bucket));
		return { ok: true, remaining: max - bucket.count };
	} catch (err) {
		if (opts.failClosed) {
			// Fail closed: an unavailable store must not let requests bypass a
			// security-sensitive limit.
			console.error("rateLimit: state store unavailable, denying request", err);
			return { ok: false, remaining: 0 };
		}
		// Fail open: rate limiting is defense-in-depth — an unavailable state
		// store must not take the public endpoints down with it.
		console.error("rateLimit: state store unavailable, allowing request", err);
		return { ok: true, remaining: max };
	}
}

// Per-IP gate run BEFORE the project lookup on the public widget routes, so a
// flood of requests bearing unknown/invalid project keys can't drive unbounded
// DB lookups. Generous — a legit embed polls only a few times/sec, and many
// visitors can share one NATed IP — while still capping a flood to ~10 req/s/IP.
// Fails OPEN (public path): a STATE blip must not take the widget down.
const PUBLIC_LOOKUP_MAX = 600;
const PUBLIC_LOOKUP_WINDOW = 60;

export function publicLookupRateLimit(env: Env, ip: string) {
	return rateLimit(
		env,
		`pubkey:${ip}`,
		PUBLIC_LOOKUP_MAX,
		PUBLIC_LOOKUP_WINDOW,
	);
}
