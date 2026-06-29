import type { Env } from "@/env";

/** The header Ploy's edge populates with the real client IP. Ploy's authoritative
 * header isn't documented in the SDK/types, so it's operator-configurable via
 * TRUSTED_CLIENT_IP_HEADER and defaults to Cloudflare's `cf-connecting-ip`. */
const DEFAULT_TRUSTED_IP_HEADER = "cf-connecting-ip";

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
 * `cf-connecting-ip`). We deliberately do NOT fall back to a bare
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
