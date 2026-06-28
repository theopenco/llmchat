/** Pure workspace-selection logic, split out from the provider so the
 * stale-selection edge cases can be unit-tested without React. */

import { isPaidPlan } from "@llmchat/shared";
import type { Plan } from "@llmchat/shared";

// Billing plan enum, single-sourced from the API's tier table. "none" = no
// active subscription (paid-only product); starter|growth|scale are the paid
// tiers. Re-exported so dashboard modules keep importing `Plan` from here.
export type { Plan };

/** Workspace RBAC roles, mirrored from the API. Higher roles include the
 * capabilities of lower ones: owner ⊃ admin ⊃ agent. */
export type WorkspaceRole = "owner" | "admin" | "agent";

export interface WorkspaceSummary {
	id: string;
	name: string;
	plan: Plan;
	/** The current user's role in this workspace. */
	role: WorkspaceRole;
	/** How many projects this workspace has. Drives default-workspace selection
	 * (a non-empty, paid workspace wins over an empty one). Optional so a legacy
	 * or mocked response without it degrades to plain first-row selection. */
	projectCount?: number;
}

/** Shape of the API's /api/workspaces response — a join row pairing each
 * workspace with the caller's membership role and its project count. */
export interface WorkspacesResponse {
	workspaces: {
		workspace: Omit<WorkspaceSummary, "role" | "projectCount">;
		role: WorkspaceRole;
		projectCount?: number;
	}[];
}

/** Whether a role may perform workspace-management actions (create/edit/delete
 * projects, manage sources & prompts). Agents are support-only: they work the
 * inbox but can't reconfigure bots. Mirrors the API's requireRole("admin"). */
export function canManage(role: WorkspaceRole | null | undefined): boolean {
	return role === "owner" || role === "admin";
}

/** Shared react-query key so server prefetch and the client provider hydrate
 * against the same cache entry. */
export const WORKSPACES_KEY = ["workspaces"] as const;

/**
 * Decide which workspace should be active given the persisted selection and the
 * set the user currently belongs to.
 *
 * - no workspaces            -> null
 * - stored id still valid    -> keep it (honor the explicit choice, even if it's
 *                               an empty workspace the user deliberately switched
 *                               into to set up)
 * - stored stale / missing   -> a sensible default (see pickDefaultWorkspace)
 */
export function resolveWorkspaceId(
	stored: string | null,
	workspaces: WorkspaceSummary[],
): string | null {
	if (workspaces.length === 0) return null;
	if (stored && workspaces.some((w) => w.id === stored)) return stored;
	return pickDefaultWorkspace(workspaces);
}

/**
 * Choose the default active workspace when there's no valid stored selection.
 * Blindly taking the first row (the old behavior) stranded a member of a
 * non-empty paid workspace on /onboarding whenever an empty workspace happened
 * to sort first — the API has no ORDER BY, and the onboarding gate only ever
 * looks at the *active* workspace. So prefer a workspace that actually has
 * projects, and among those a paid one, before falling back to the first row.
 */
function pickDefaultWorkspace(workspaces: WorkspaceSummary[]): string {
	const nonEmpty = workspaces.filter((w) => (w.projectCount ?? 0) > 0);
	const pool = nonEmpty.length > 0 ? nonEmpty : workspaces;
	const paid = pool.find((w) => isPaidPlan(w.plan));
	return (paid ?? pool[0]!).id;
}
