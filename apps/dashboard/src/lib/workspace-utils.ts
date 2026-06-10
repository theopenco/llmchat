/** Pure workspace-selection logic, split out from the provider so the
 * stale-selection edge cases can be unit-tested without React. */

export interface WorkspaceSummary {
	id: string;
	name: string;
}

/** Shape of the API's /api/workspaces response. */
export interface WorkspacesResponse {
	workspaces: { workspace: WorkspaceSummary }[];
}

/** Shared react-query key so server prefetch and the client provider hydrate
 * against the same cache entry. */
export const WORKSPACES_KEY = ["workspaces"] as const;

/**
 * Decide which workspace should be active given the persisted selection and the
 * set the user currently belongs to.
 *
 * - no workspaces            -> null (nothing to select)
 * - stored id still valid    -> keep it (honor the user's choice)
 * - stored id stale/missing  -> first workspace (so a deleted/foreign id can't
 *                               pin the UI to a workspace that no longer exists)
 */
export function resolveWorkspaceId(
	stored: string | null,
	workspaces: WorkspaceSummary[],
): string | null {
	if (workspaces.length === 0) return null;
	if (stored && workspaces.some((w) => w.id === stored)) return stored;
	return workspaces[0]!.id;
}
