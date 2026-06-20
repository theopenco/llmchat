import { apiBaseUrl } from "./api-base";
import { authClient } from "./auth-client";

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
 */
export function startSocialSignIn(provider: SocialProvider) {
	return authClient.signIn.social({
		provider,
		callbackURL: `${window.location.origin}/onboarding`,
		errorCallbackURL: `${window.location.origin}/sign-in?error=oauth`,
	});
}
