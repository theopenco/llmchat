import { cache } from "react";

import { apiServer } from "./api-server";

export interface ServerSession {
	user: { id: string; email: string };
}

/**
 * Resolve the current session on the server by asking the API's Better Auth
 * endpoint with the forwarded cookies. Wrapped in React `cache()` so multiple
 * callers in one request (layout, page) share a single fetch.
 *
 * Returns null on any failure rather than throwing: a missing session and an
 * unreachable/cross-origin cookie look the same here, so callers treat null as
 * "couldn't confirm" and let the client auth gate take over.
 */
export const getServerSession = cache(
	async (): Promise<ServerSession | null> => {
		try {
			const session = await apiServer<ServerSession | null>(
				"/api/auth/get-session",
			);
			return session?.user ? session : null;
		} catch {
			return null;
		}
	},
);
