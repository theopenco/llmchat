/** Pure workspace-selection logic, split out from the provider so the
 * stale-selection edge cases can be unit-tested without React. */

import type { Plan } from "@llmchat/shared";

import { resolveSelectedId } from "./selection";

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
}

/** Shape of the API's /api/workspaces response — a join row pairing each
 * workspace with the caller's membership role. */
export interface WorkspacesResponse {
	workspaces: {
		workspace: Omit<WorkspaceSummary, "role">;
		role: WorkspaceRole;
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
 * Decide which workspace should be active given the persisted selection and
 * the set the user currently belongs to. See resolveSelectedId for the rules.
 */
export function resolveWorkspaceId(
	stored: string | null,
	workspaces: WorkspaceSummary[],
): string | null {
	return resolveSelectedId(stored, workspaces);
}
