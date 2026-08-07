import { apiBaseUrl } from "./api-base";
import { authClient } from "./auth-client";
import { stashPendingInvite } from "./invite-return";

export type SocialProvider = "google" | "github";

export interface OAuthProviders {
	google: boolean;
	github: boolean;
}

/**
 * Which social providers are enabled, per the API (the single source of truth —
 * a provider is on only when its server-side credentials are configured). Read
 * by the logged-out sign-in/sign-up pages, so it's public + unauthenticated. On
 * any failure we report everything off, so the buttons fail safe to disabled.
 */
export async function fetchOAuthProviders(): Promise<OAuthProviders> {
	try {
		const res = await fetch(`${apiBaseUrl()}/api/oauth-providers`);
		if (!res.ok) return { google: false, github: false };
		return (await res.json()) as OAuthProviders;
	} catch {
		return { google: false, github: false };
	}
}

/**
 * Kick off Better Auth's hosted OAuth flow. `callbackURL` lands the user back on
 * the dashboard at /onboarding — the same entry point as an email sign-up, where
 * the onboarding guard provisions/redirects (a returning user is bounced to
 * /inbox). Absolute URL so Better Auth (served on the API origin) redirects to
 * the dashboard origin; it's a trusted origin.
 *
 * A pending invite can't ride the URL through this round-trip (the fixed
 * callbackURL drops the auth page's query string), so it's stashed for the
 * boot check on /onboarding to consume. Always called — with null when there
 * is no invite — so a stale stash from an abandoned earlier attempt can never
 * hijack a plain sign-in.
 */
export function startSocialSignIn(
	provider: SocialProvider,
	inviteToken?: string | null,
) {
	stashPendingInvite(inviteToken ?? null);
	// The error return must keep carrying the invite in the URL: a retry click
	// on that page re-reads it from there (and re-stashes). Without it the
	// retry would read "no invite" and its stale-stash clear would wipe the
	// stash that had survived the failed attempt — the original bug, back on
	// the first-retry journey.
	const errorQuery = inviteToken
		? `error=oauth&invite=${encodeURIComponent(inviteToken)}`
		: "error=oauth";
	return authClient.signIn.social({
		provider,
		callbackURL: `${window.location.origin}/onboarding`,
		errorCallbackURL: `${window.location.origin}/sign-in?${errorQuery}`,
	});
}
