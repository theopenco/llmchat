import { db } from "@/lib/db";

import { eq, project } from "@llmchat/db";

import type { Env } from "@/env";

/**
 * Every project id in a workspace — the single source of truth for "rows that
 * belong to my workspace" on tables scoped only by `projectId`.
 *
 * `conversation` and `message` carry NO `workspaceId` (conversation → project,
 * message → conversation → project), so a cross-project query CANNOT assert the
 * tenant boundary on its own. The safe pattern is: resolve the workspace's
 * project-id set here, then intersect every query with it
 * (`inArray(conversation.projectId, ids)`). Expressing the boundary ONCE — here,
 * rather than re-inlining a project→workspace join in each endpoint — is what
 * keeps the IDOR class (results leaking across tenants) from recurring.
 *
 * Callers MUST pass the membership-validated `c.get("workspaceId")` (set by
 * requireWorkspace after re-checking the `x-workspace-id` header against the
 * `member` table) — NEVER a raw header or request param.
 *
 * Reused by ⌘K global search and (planned) the #105 workspace-wide unified
 * inbox, so the cross-project scope is audited in one place.
 */
export async function workspaceProjectIds(
	env: Env,
	workspaceId: string,
): Promise<string[]> {
	const rows = await db(env)
		.select({ id: project.id })
		.from(project)
		.where(eq(project.workspaceId, workspaceId));
	return rows.map((r) => r.id);
}
