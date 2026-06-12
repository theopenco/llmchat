import { createAuthClient } from "better-auth/react";

import { apiBaseUrl } from "./api-base";

export const authClient = createAuthClient({
	baseURL: apiBaseUrl(),
});

export const { useSession, signIn, signUp, signOut } = authClient;
