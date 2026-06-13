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

function isUsableOriginEntry(entry: string): boolean {
	try {
		const url = new URL(entry);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * The /v1 widget CORS policy. `allowedCsv` is the WIDGET_ALLOWED_ORIGINS env
 * value: empty or "*" means any origin (the widget is a public embed); a
 * comma-separated list restricts to those origins and their Ploy previews.
 * Returns the origin value to echo in access-control-allow-origin, or null
 * to reject.
 *
 * Entries that aren't parseable http(s) urls are ignored — e.g. an
 * unsubstituted `$WIDGET_ALLOWED_ORIGINS` reference when the deployment
 * secret was never created. A list with no usable entries behaves like an
 * unset one (open): this endpoint is credential-less and public by design,
 * so a broken allowlist must not silently brick every embed.
 */
export function allowWidgetOrigin(
	origin: string | undefined,
	allowedCsv: string | undefined,
): string | null {
	const entries = (allowedCsv ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (entries.includes("*")) {
		return origin ?? "*";
	}
	const list = entries.filter(isUsableOriginEntry);
	if (list.length === 0) {
		return origin ?? "*";
	}
	return list.some((entry) => isAllowedOrigin(origin, entry))
		? (origin ?? null)
		: null;
}
