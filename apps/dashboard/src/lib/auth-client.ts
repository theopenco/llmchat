import { createAuthClient } from "better-auth/react";

import { apiBaseUrl } from "./api-base";

export const authClient = createAuthClient({
	baseURL: apiBaseUrl(),
});

export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * True when a useSession error is a transient server failure — a 429 from a
 * rate-limit blip, a 5xx, a gateway error — rather than a definitive "not
 * signed in". Better Auth's focus/online refetch nulls its session store on ANY
 * failed get-session response, so an auth gate that redirects on a bare null
 * session turns every blip into a spontaneous sign-out while the cookie is
 * still perfectly valid. Gates must hold (render a skeleton, wait for the next
 * refetch) on a transient error and only redirect on a definitive one: a clean
 * 200-null (no error) or a real 401.
 */
export function isTransientSessionError(
	error: { status?: number } | null | undefined,
): boolean {
	return !!error && error.status !== 401;
}
