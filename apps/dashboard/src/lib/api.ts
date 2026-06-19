import { apiBaseUrl } from "./api-base";

export interface ApiOptions {
	method?: string;
	body?: unknown;
	workspaceId?: string;
}

/** Carries the HTTP status (and machine `code`, when the body is a JSON error)
 * so callers can branch — recover from a stale workspace, distinguish a
 * plan-limit from a permission denial — instead of string-matching the message. */
export class ApiError extends Error {
	/** Machine-readable error code from a `{ error | code }` JSON body, if any. */
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
			// Non-JSON body (e.g. a plain-text 500) — leave code undefined.
		}
	}
}

/** A failed `x-workspace-id` assertion: the active workspace is missing (400)
 * or the user isn't a member of it (403). Onboarding uses this to self-heal a
 * stale/broken workspace context by provisioning a fresh workspace.
 *
 * Excludes role denials (`insufficient_role`): an agent hitting an admin-only
 * route is a legitimately-forbidden action, not a broken workspace context, so
 * it must NOT trigger re-provisioning. */
export function isWorkspaceAuthError(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		error.code !== "insufficient_role" &&
		(error.status === 400 || error.status === 403)
	);
}

/** Map an API failure to a friendly, actionable sentence for a toast. Centralized
 * so every mutation surfaces permission / rate-limit errors consistently
 * instead of leaking the raw `API 4xx: …` string. */
export function describeApiError(error: unknown, fallback: string): string {
	if (!(error instanceof ApiError)) {
		return error instanceof Error ? error.message : fallback;
	}
	if (error.code === "insufficient_role") {
		return "You don't have permission to do that. Ask a workspace owner or admin.";
	}
	if (error.status === 429) return "Too many requests — try again in a moment.";
	if (error.status === 403) return "You don't have access to this workspace.";
	return fallback;
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
