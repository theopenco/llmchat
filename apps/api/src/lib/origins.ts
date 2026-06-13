/**
 * Whether a request origin is the dashboard. Accepts the canonical
 * `DASHBOARD_URL` origin plus Ploy preview deployments of the same app —
 * `<name>--<sha>` / `<name>---<branch>` hosts on the same domain — so PR
 * previews of the dashboard can talk to the API. Used for both CORS and
 * Better Auth CSRF trust, so keep it strict: same protocol, same domain, and
 * the host must be the dashboard's own name plus a `--` preview suffix.
 */
export function isAllowedDashboardOrigin(
	origin: string | undefined,
	dashboardUrl: string | undefined,
): boolean {
	if (!origin || !dashboardUrl) {
		return false;
	}
	if (origin === dashboardUrl) {
		return true;
	}
	let allowed: URL;
	let candidate: URL;
	try {
		allowed = new URL(dashboardUrl);
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
	const [name, ...domainParts] = allowed.hostname.split(".");
	const [candidateName, ...candidateDomainParts] =
		candidate.hostname.split(".");
	return (
		domainParts.length > 0 &&
		domainParts.join(".") === candidateDomainParts.join(".") &&
		candidateName.startsWith(`${name}--`)
	);
}
