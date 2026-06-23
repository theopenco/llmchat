import type { Env } from "@/env";

/**
 * Durable rate-limit storage for Better Auth, backed by the Ploy `state:` binding.
 *
 * Wired as `rateLimit.customStorage` (NOT `secondaryStorage`) on purpose: Better
 * Auth's `secondaryStorage` would also relocate SESSIONS out of the D1 `session`
 * table (every `findSession` reads KV-first), coupling auth to STATE uptime and
 * threatening the account-delete cascade. `customStorage` is a dedicated
 * rate-limit store — sessions stay 100% in D1.
 *
 * Better Auth's in-memory default doesn't survive across workerd isolates, so
 * rate limits were effectively absent. This persists the bucket in STATE, shared
 * across isolates.
 *
 * Fail-CLOSED (auth path, per the standing security rule): when STATE is
 * unavailable the read returns a synthetic over-limit bucket so Better Auth
 * responds 429 rather than allowing unbounded auth attempts. (The public widget
 * limiter in `kv.ts` stays fail-open — see its `failClosed` option — so a STATE
 * blip never takes the embed down; PR1's spend caps already bound that cost.)
 */

/**
 * The bucket shape Better Auth stores per (ip, path). Window-reset is Better
 * Auth's job, NOT this storage's: its `shouldRateLimit` ignores any bucket whose
 * `lastRequest` is older than the (per-path) window, and its post-response hook
 * rewrites `count:1` once the window elapses. So we deliberately store NO
 * `resetAt`/TTL here and add no expiry logic — doing so would hardcode a single
 * window and fight Better Auth's per-path windows (3/10s vs 3/60s). The synthetic
 * fail-closed bucket below self-heals for the same reason (its `lastRequest`
 * ages out of the window). `lastRequest` is in MILLISECONDS, per Better Auth.
 */
interface RateLimitBucket {
	key: string;
	count: number;
	lastRequest: number;
}

const KEY_PREFIX = "authrl:";

export interface RateLimitCustomStorage {
	get(key: string): Promise<RateLimitBucket | null>;
	set(key: string, value: RateLimitBucket): Promise<void>;
}

export function createAuthRateLimitStorage(env: Env): RateLimitCustomStorage {
	return {
		async get(key) {
			try {
				const raw = await env.STATE.get(KEY_PREFIX + key);
				if (!raw) return null;
				try {
					return JSON.parse(raw) as RateLimitBucket;
				} catch {
					// Malformed entry — treat as a fresh window (not an outage).
					return null;
				}
			} catch (err) {
				// STATE unavailable — FAIL CLOSED: hand back a bucket that is already
				// over any limit so Better Auth denies (429) this auth request.
				console.error("authRateLimit: STATE read failed, failing closed", err);
				return {
					key,
					count: Number.MAX_SAFE_INTEGER,
					lastRequest: Date.now(),
				};
			}
		},
		async set(key, value) {
			try {
				await env.STATE.set(KEY_PREFIX + key, JSON.stringify(value));
			} catch (err) {
				// The deny decision already happened on read; a failed write can't open
				// a hole. Swallow so we don't surface a 500 from a post-response hook.
				console.error("authRateLimit: STATE write failed", err);
			}
		},
	};
}
