/** Pure workspace-selection logic, split out from the provider so the
 * stale-selection edge cases can be unit-tested without React. */

import { resolveSelectedId } from "./selection";

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
 * Decide which workspace should be active given the persisted selection and
 * the set the user currently belongs to. See resolveSelectedId for the rules.
 */
export function resolveWorkspaceId(
	stored: string | null,
	workspaces: WorkspaceSummary[],
): string | null {
	return resolveSelectedId(stored, workspaces);
}
