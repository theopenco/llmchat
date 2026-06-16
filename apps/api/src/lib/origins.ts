/**
 * Whether a request origin matches an allowed canonical origin. Accepts the
 * exact origin plus Ploy preview deployments of the same app —
 * `<name>--<sha>` / `<name>---<branch>` hosts on the same domain — so PR
 * previews keep working. Used for CORS and Better Auth CSRF trust, so keep
 * it strict: same protocol, same port, same domain, and the host must be the
 * canonical first label plus a `--` preview suffix.
 */
export function isAllowedOrigin(
	origin: string | undefined,
	canonicalUrl: string | undefined,
): boolean {
	if (!origin || !canonicalUrl) {
		return false;
	}
	if (origin === canonicalUrl) {
		return true;
	}
	let allowed: URL;
	let candidate: URL;
	try {
		allowed = new URL(canonicalUrl);
		candidate = new URL(origin);
	} catch {
		return false;
	}
	if (
		candidate.protocol !== allowed.protocol ||
		candidate.port !== allowed.port
	) {
		return false;
	}
	// Tolerate trailing slashes / path noise in configured values: an Origin
	// header is always a bare origin, so compare parsed origins.
	if (candidate.origin === allowed.origin) {
		return true;
	}
	const [name, ...domainParts] = allowed.hostname.split(".");
	const [candidateName, ...candidateDomainParts] =
		candidate.hostname.split(".");
	return (
		domainParts.length > 0 &&
		domainParts.join(".") === candidateDomainParts.join(".") &&
		candidateName.startsWith(`${name}--`)
	);
}

// NOTE: the public /v1/* widget endpoints intentionally have NO origin
// allowlist — they allow all origins unconditionally (see the CORS wiring in
// src/index.ts). `isAllowedOrigin` above is only for the credentialed /api/*
// dashboard routes and Better Auth CSRF trust.
