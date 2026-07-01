import { apiBaseUrl } from "./api-base";

/** Carries the HTTP status (and machine `code`, when the body is JSON) so
 * callers can branch — e.g. 401 (signed out) vs 403 (not an admin). */
export class ApiError extends Error {
	readonly code?: string;

	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`API ${status}: ${body}`);
		this.name = "ApiError";
		try {
			const parsed = JSON.parse(body) as { error?: string; code?: string };
			this.code = parsed.code ?? parsed.error;
		} catch {
			// Non-JSON body — leave code undefined.
		}
	}
}

export interface ApiOptions {
	method?: string;
	body?: unknown;
	signal?: AbortSignal;
}

/** Credentialed fetch against the API. No `x-workspace-id` — the admin routes
 * are global (cross-tenant), gated by the platform-admin session, not a
 * workspace membership. */
export async function api<T>(
	path: string,
	{ method = "GET", body, signal }: ApiOptions = {},
): Promise<T> {
	const res = await fetch(`${apiBaseUrl()}${path}`, {
		method,
		credentials: "include",
		signal,
		headers: { "content-type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		throw new ApiError(res.status, await res.text());
	}
	return (await res.json()) as T;
}
