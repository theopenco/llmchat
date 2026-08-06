/**
 * Redact secrets that ride a URL PATH before that URL is handed to analytics.
 *
 * The invite flow delivers a bearer token as `/invite/<token>` (docs/goals/
 * invites.md R5: the token rides the link only — never logged, never in
 * analytics). The dashboard's PostHog integration sends `$current_url` on
 * every App Router navigation, so without this the token would land in an
 * analytics payload the moment an invitee opened their link.
 *
 * Pure and total: any URL string in, a safe URL string out.
 */

/** Path prefixes whose next segment is a credential, not an identifier. */
const SECRET_PATH_SEGMENTS = ["/invite/"];

export function scrubUrl(url: string): string {
	let out = url;
	for (const prefix of SECRET_PATH_SEGMENTS) {
		const at = out.indexOf(prefix);
		if (at === -1) continue;
		const start = at + prefix.length;
		// Keep anything structural after the secret (a trailing path, ?query,
		// #hash) so the redacted URL still describes the route.
		const rest = out.slice(start);
		const end = rest.search(/[/?#]/);
		out =
			out.slice(0, start) + "[redacted]" + (end === -1 ? "" : rest.slice(end));
	}
	return out;
}

/** True when `path` is a route whose URL carries a secret. */
export function isSecretPath(path: string): boolean {
	return SECRET_PATH_SEGMENTS.some((p) => path.startsWith(p));
}
