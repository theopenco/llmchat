import { createAuthClient } from "better-auth/react";

// Points at the API (where Better Auth lives). The /api/auth/* CORS allowlist
// includes the marketing origin, so the public site can read the session and
// flip "Sign in" to "Dashboard".
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
});

export const { useSession } = authClient;
