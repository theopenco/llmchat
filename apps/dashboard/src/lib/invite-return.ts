/**
 * Carrying an invitation through sign-in / sign-up.
 *
 * An invitee who isn't signed in has to authenticate first, and afterwards
 * must land back on their invitation — NOT on the default destination. For a
 * brand-new invitee that default is /onboarding, which is the hard paywall
 * before the first project: without this they'd be asked to pay to join a
 * workspace someone else already pays for.
 *
 * The token travels as a query param between our own pages only. It is never
 * sent to the API this way (accept/preview take it in a POST body), and the
 * analytics scrubber redacts it from any URL that reaches PostHog.
 *
 * The OAuth leg can't use the query param: Better Auth's hosted flow returns
 * to a fixed callbackURL (/onboarding), so anything in the auth page's URL is
 * gone by the time the user is back. For that round-trip the token is stashed
 * in sessionStorage — tab-scoped (the OAuth redirect stays in the tab; a link
 * opened in a new tab carries the param instead) and single-use: the boot
 * check on /onboarding consumes it, and starting a social sign-in WITHOUT an
 * invite clears any stale stash so it can never hijack a plain sign-in.
 */

export const INVITE_PARAM = "invite";

export const PENDING_INVITE_KEY = "pendingInviteToken";

/**
 * Stash a pending invite for the OAuth round-trip, or clear the stash when
 * `token` is null. Storage failures (private mode, SSR) fall through to the
 * old behavior: the invite is lost and the user re-clicks their email link.
 */
export function stashPendingInvite(token: string | null): void {
	try {
		if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token);
		else sessionStorage.removeItem(PENDING_INVITE_KEY);
	} catch {
		// Storage unavailable — degrade to the query-param-only behavior.
	}
}

/** Read the stashed token without consuming it (safe to call during render). */
export function peekPendingInvite(): string | null {
	try {
		const token = sessionStorage.getItem(PENDING_INVITE_KEY);
		return token && token.trim() ? token : null;
	} catch {
		return null;
	}
}

/** Read AND clear the stash — the boot check's single-use consumption. */
export function consumePendingInvite(): string | null {
	const token = peekPendingInvite();
	if (token) stashPendingInvite(null);
	return token;
}

/** Read the pending invite token off a search string, if any. */
export function inviteTokenFrom(
	search: string | URLSearchParams | null | undefined,
): string | null {
	if (!search) return null;
	const params =
		typeof search === "string" ? new URLSearchParams(search) : search;
	const token = params.get(INVITE_PARAM);
	return token && token.trim() ? token : null;
}

/** Where to send the user after authenticating. */
export function postAuthDestination(
	search: string | URLSearchParams | null | undefined,
	fallback: string,
): string {
	const token = inviteTokenFrom(search);
	return token ? `/invite/${encodeURIComponent(token)}` : fallback;
}

/** Preserve a pending invite across the sign-in ⇄ sign-up links. */
export function withInvite(
	path: string,
	search: string | URLSearchParams | null | undefined,
): string {
	const token = inviteTokenFrom(search);
	return token ? `${path}?${INVITE_PARAM}=${encodeURIComponent(token)}` : path;
}
