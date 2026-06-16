import { createAuthClient } from "better-auth/react";

// Points at the API. The /api/auth/* CORS allowlist includes the showcase
// origin, so the demo can read the session and flip "Sign in" to "Dashboard".
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
});

export const { useSession } = authClient;
