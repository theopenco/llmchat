import { apiBaseUrl } from "./api-base";

export interface ApiOptions {
	method?: string;
	body?: unknown;
	workspaceId?: string;
}

/** Carries the HTTP status so callers can branch (e.g. recover from a stale
 * workspace) instead of string-matching the message. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: string,
	) {
		super(`API ${status}: ${body}`);
		this.name = "ApiError";
	}
}

/** A failed `x-workspace-id` assertion: the active workspace is missing (400)
 * or the user isn't a member of it (403). Onboarding uses this to self-heal a
 * stale/broken workspace context by provisioning a fresh workspace. */
export function isWorkspaceAuthError(error: unknown): boolean {
	return (
		error instanceof ApiError && (error.status === 400 || error.status === 403)
	);
}

export async function api<T>(
	path: string,
	{ method = "GET", body, workspaceId }: ApiOptions = {},
): Promise<T> {
	const res = await fetch(`${apiBaseUrl()}${path}`, {
		method,
		credentials: "include",
		headers: {
			"content-type": "application/json",
			...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		throw new ApiError(res.status, await res.text());
	}
	return (await res.json()) as T;
}
