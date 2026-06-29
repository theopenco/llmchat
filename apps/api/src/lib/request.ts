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
 * yields "unknown" rather than a forgeable per-request key — and warns loudly
 * (see below), because a header/edge misconfig that makes every request "unknown"
 * is what collapsed all visitors into one rate-limit bucket in the earlier outage.
 */
export function clientIp(c: {
	req: { header(name: string): string | undefined };
	env?: Env;
}): string {
	const header = trustedIpHeader(c.env);
	const ip = c.req.header(header)?.trim();
	if (ip) return ip;
	warnMissingTrustedIpOnce(c.env, header);
	return "unknown";
}

/**
 * The rate-limit bucket discriminator. Normally the real client IP. When the
 * trusted IP header is absent (`ip === "unknown"` — an edge/header misconfig), we
 * fall back to the per-visitor `clientId` instead of collapsing EVERY visitor into
 * one shared `…:unknown` bucket — the failure mode that 429'd all traffic into a
 * single bucket during the earlier outage. `clientId` is client-supplied (weaker
 * than a real IP, so a determined attacker could rotate it to evade the per-project
 * cap), but this path engages ONLY during a misconfig — which `clientId` also alarms
 * on (clientIp), and where total volume stays bounded by the fail-open pre-lookup
 * gate and the ~2k-token output cap. So it trades the old mass-429 availability
 * failure for a bounded, alarmed cost exposure rather than a silent one — the right
 * call for a misconfig window, not a substitute for a correctly configured IP header.
 */
export function rateLimitSubject(ip: string, clientId: string): string {
	if (ip && ip !== "unknown") return ip;
	if (clientId) return `c:${clientId}`;
	return "unknown";
}

// Warn at most once per isolate when the trusted IP header is missing on a
// prod-like request — surfaces a header/edge misconfig LOUDLY (the silent failure
// that caused the earlier outage) before it can degrade rate limiting site-wide.
// Suppressed in local dev (DASHBOARD_URL points at localhost) to avoid noise.
let warnedMissingTrustedIp = false;

function warnMissingTrustedIpOnce(env: Env | undefined, header: string): void {
	if (warnedMissingTrustedIp) return;
	const dashboard = env?.vars?.DASHBOARD_URL ?? "";
	const prodLike =
		dashboard !== "" &&
		!dashboard.includes("localhost") &&
		!dashboard.includes("127.0.0.1");
	if (!prodLike) return;
	warnedMissingTrustedIp = true;
	console.error(
		`clientIp: trusted IP header "${header}" is ABSENT on an incoming request ` +
			`in production — per-IP rate limiting is now falling back to per-clientId ` +
			`buckets. The edge/proxy is not setting it; verify TRUSTED_CLIENT_IP_HEADER ` +
			`and the Ploy/Cloudflare configuration before this degrades protection.`,
	);
}
