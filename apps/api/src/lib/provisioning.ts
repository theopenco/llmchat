import { member, workspace } from "@llmchat/db";

import type { db } from "@/lib/db";

type Database = ReturnType<typeof db>;

/** Workspace name for a new account; falls back when no name is given. */
export function defaultWorkspaceName(userName?: string | null): string {
	const trimmed = userName?.trim();
	return trimmed ? `${trimmed}'s workspace` : "My workspace";
}

/**
 * Create a free-plan workspace plus the owner membership for a user. Shared by
 * the sign-up provisioning hook and the workspaces endpoint so the two can't
 * drift (plan defaults to "free" at the schema level). The db is injected so
 * callers control the binding and the unit is testable in isolation.
 */
export async function provisionWorkspace(
	database: Database,
	userId: string,
	name: string,
) {
	const [ws] = await database
		.insert(workspace)
		.values({ name, ownerId: userId })
		.returning();
	await database
		.insert(member)
		.values({ workspaceId: ws!.id, userId, role: "owner" });
	return ws!;
}
