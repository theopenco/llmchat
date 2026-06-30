import type { Env } from "@/env";

/** The header Ploy's edge populates with the real client IP. Ploy forwards the
 * client IP in `x-real-ip` for the api worker, so that's the baked-in default —
 * correct out-of-the-box for our infra without depending on an env var being set
 * (a missing/lost TRUSTED_CLIENT_IP_HEADER previously collapsed every visitor into
 * one "unknown" rate-limit bucket → outage). Still operator-overridable via
 * TRUSTED_CLIENT_IP_HEADER for a different host (e.g. Cloudflare's
 * `cf-connecting-ip`). */
const DEFAULT_TRUSTED_IP_HEADER = "x-real-ip";

function trustedIpHeader(env?: Env): string {
	return env?.vars.TRUSTED_CLIENT_IP_HEADER || DEFAULT_TRUSTED_IP_HEADER;
}

/** The list of IP headers Better Auth's `getIp` should trust — exactly the one
 * trusted header, never the spoofable `x-forwarded-for` fallback. */
export function trustedIpHeaders(env?: Env): string[] {
	return [trustedIpHeader(env)];
}

/**
 * Client IP for rate-limit keys. workerd sits behind Ploy's proxy, so we read
 * ONLY the trusted edge-set header (TRUSTED_CLIENT_IP_HEADER, default
 * `x-real-ip`). We deliberately do NOT fall back to a bare
 * `x-forwarded-for`: that header is client-supplied and lets an attacker rotate
 * it to evade — or pollute — IP-scoped rate limits. An absent trusted header
 * yields "unknown" (a shared bucket) rather than a forgeable per-request key.
 */
export function clientIp(c: {
	req: { header(name: string): string | undefined };
	env?: Env;
}): string {
	return c.req.header(trustedIpHeader(c.env))?.trim() || "unknown";
}
