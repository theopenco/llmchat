import type { Env } from "@/env";

export async function rateLimit(
	env: Env,
	key: string,
	max: number,
	windowSeconds: number,
): Promise<{ ok: boolean; remaining: number }> {
	const cacheKey = `ratelimit:${key}`;
	const raw = await env.CACHE.get(cacheKey);
	const count = raw ? parseInt(raw, 10) : 0;
	if (count >= max) {
		return { ok: false, remaining: 0 };
	}
	await env.CACHE.put(cacheKey, String(count + 1), {
		expirationTtl: windowSeconds,
	});
	return { ok: true, remaining: max - count - 1 };
}
