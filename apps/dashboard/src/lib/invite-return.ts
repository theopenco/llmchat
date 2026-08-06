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
 */

export const INVITE_PARAM = "invite";

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
