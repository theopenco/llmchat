import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export interface ApiServerOptions {
	workspaceId?: string;
}

/**
 * Server-side twin of `lib/api.ts`. Forwards the incoming request's cookies to
 * the API so React Server Components can fetch authenticated data during render.
 *
 * Note: this only carries the session when the API's auth cookie is visible to
 * the dashboard origin — true in dev (same host) and in prod when Better Auth is
 * configured with a shared parent-domain cookie. When it isn't, callers fall
 * back to the client fetcher, so server prefetching stays a safe enhancement.
 */
export async function apiServer<T>(
	path: string,
	{ workspaceId }: ApiServerOptions = {},
): Promise<T> {
	const cookieHeader = (await cookies()).toString();
	const res = await fetch(`${API_URL}${path}`, {
		headers: {
			...(cookieHeader ? { cookie: cookieHeader } : {}),
			...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
		},
		cache: "no-store",
	});
	if (!res.ok) {
		throw new Error(`API ${res.status}`);
	}
	return (await res.json()) as T;
}
