import type { Env } from "@/env";

interface RateBucket {
	count: number;
	// unix seconds; the window is considered expired once now passes this.
	resetAt: number;
}

// Fixed-window rate limiter backed by the Ploy `state:` binding. We only use
// `get`/`set` (not `put` + `expirationTtl`) because the deployed state binding
// doesn't expose `put`, and expiry is tracked in the stored value instead.
export async function rateLimit(
	env: Env,
	key: string,
	max: number,
	windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
	const cacheKey = `ratelimit:${key}`;
	const now = Math.floor(Date.now() / 1000);

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
}
