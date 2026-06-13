import type { Env } from "@/env";

export async function rateLimit(
	env: Env,
	key: string,
	max: number,
	windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
	const cacheKey = `ratelimit:${key}`;
	try {
		const raw = await env.CACHE.get(cacheKey);
		const count = raw ? parseInt(raw, 10) : 0;
		if (count >= max) {
			return { ok: false, remaining: 0 };
		}
		await env.CACHE.put(cacheKey, String(count + 1), {
			expirationTtl: windowSeconds,
		});
		return { ok: true, remaining: max - count - 1 };
	} catch (err) {
		// Fail open: rate limiting is defense-in-depth — an unavailable state
		// store must not take the public endpoints down with it.
		console.error("rateLimit: state store unavailable, allowing request", err);
		return { ok: true, remaining: max };
	}
}
