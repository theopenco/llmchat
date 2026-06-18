import { createAuthClient } from "better-auth/react";

import { CANONICAL_API_URL } from "@/lib/site-urls";

// Points at the API (where Better Auth lives). The /api/auth/* CORS allowlist
// includes the marketing origin, so the public site can read the session and
// flip "Sign in" to "Dashboard".
export const authClient = createAuthClient({
	baseURL: CANONICAL_API_URL,
});

export const { useSession } = authClient;
