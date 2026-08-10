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
 *
 * ONE carve-out: `/get-session` fails OPEN. It's a read that grants nothing an
 * attacker can't get by just retrying (no credential attempt to bound), but a
 * fail-closed 429 on it makes every signed-in dashboard treat the blip as a
 * sign-out (the Better Auth client nulls its session store on any failed
 * get-session refetch). Availability-first for the session read, deny-first
 * for everything else — the narrowest possible exception, keyed by exact path
 * suffix so any future key-format change falls back to fail-closed.
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

/**
 * Whether a rate-limit key may fail OPEN on a STATE outage. Better Auth keys
 * buckets as `${ip}|${path}` (createRateLimitKey in @better-auth/core), so the
 * session read — and ONLY the session read — is recognized by its exact path
 * suffix. Anything else (sign-in, sign-up, password/email changes, sign-out,
 * unknown formats) keeps the fail-closed default: if the suffix ever changes
 * shape in an upgrade, this returns false and the failure mode degrades toward
 * MORE denial, never toward an open credential path.
 */
export function mayFailOpen(key: string): boolean {
	return key.endsWith("|/get-session");
}

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
				// STATE unavailable. The session read fails OPEN (a 429 here presents
				// as a spontaneous sign-out on every open dashboard — see mayFailOpen);
				// every other auth path FAILS CLOSED: hand back a bucket that is
				// already over any limit so Better Auth denies (429) the attempt.
				if (mayFailOpen(key)) {
					console.error(
						"authRateLimit: STATE read failed, failing open (session read)",
						err,
					);
					return null;
				}
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
