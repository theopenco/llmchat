import { createAuthClient } from "better-auth/react";

import { CANONICAL_API_URL, resolveForCurrentHost } from "@/lib/site-urls";

// Points at the API (where Better Auth lives). The /api/auth/* CORS allowlist
// includes the marketing origin, so the public site can read the session and
// flip "Sign in" to "Dashboard". On Ploy preview hosts we must talk to the
// preview API sibling (same suffix) so the cross-origin cookie/CORS match.
export const authClient = createAuthClient({
	baseURL: resolveForCurrentHost(CANONICAL_API_URL),
});

export const { useSession } = authClient;
