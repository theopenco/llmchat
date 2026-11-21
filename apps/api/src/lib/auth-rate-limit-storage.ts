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
 * unavailable `consume` denies, so Better Auth responds 429 rather than
 * allowing unbounded auth attempts. (The public widget
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
 * The bucket persisted per (ip, path). `lastRequest` is in MILLISECONDS, and
 * the window is measured from it — the same rolling-window semantics as Better
 * Auth's built-in memory and database stores, so per-path rules (3/10s vs
 * 3/60s) keep their meaning. No TTL is stored: a bucket older than its window
 * is simply reset on the next request.
 */
interface RateLimitBucket {
	count: number;
	lastRequest: number;
}

interface RateLimitRule {
	window: number;
	max: number;
}

interface ConsumeResult {
	allowed: boolean;
	retryAfter: number | null;
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

function retryAfterSeconds(
	lastRequest: number,
	rule: RateLimitRule,
	now: number,
) {
	return Math.max(
		1,
		Math.ceil((lastRequest + rule.window * 1000 - now) / 1000),
	);
}

/**
 * Better Auth 1.7's storage contract: one `consume` call records the request
 * and returns the decision. STATE has no compare-and-swap, so this is a
 * read-decide-write (bounded, not atomic — the same trade-off as the widget
 * limiter in `kv.ts`).
 */
export interface RateLimitCustomStorage {
	consume(key: string, rule: RateLimitRule): Promise<ConsumeResult>;
}

export function createAuthRateLimitStorage(env: Env): RateLimitCustomStorage {
	return {
		async consume(key, rule) {
			const now = Date.now();
			let bucket: RateLimitBucket | null = null;
			try {
				const raw = await env.STATE.get(KEY_PREFIX + key);
				if (raw) {
					try {
						bucket = JSON.parse(raw) as RateLimitBucket;
					} catch {
						bucket = null;
					}
				}
			} catch (err) {
				if (mayFailOpen(key)) {
					console.error(
						"authRateLimit: STATE read failed, failing open (session read)",
						err,
					);
					return { allowed: true, retryAfter: null };
				}
				console.error("authRateLimit: STATE read failed, failing closed", err);
				return { allowed: false, retryAfter: rule.window };
			}

			const expired = !bucket || now - bucket.lastRequest >= rule.window * 1000;
			if (!expired && bucket!.count >= rule.max) {
				return {
					allowed: false,
					retryAfter: retryAfterSeconds(bucket!.lastRequest, rule, now),
				};
			}
			const next: RateLimitBucket = {
				count: expired ? 1 : bucket!.count + 1,
				lastRequest: now,
			};
			try {
				await env.STATE.set(KEY_PREFIX + key, JSON.stringify(next));
			} catch (err) {
				console.error("authRateLimit: STATE write failed", err);
			}
			return { allowed: true, retryAfter: null };
		},
	};
}
