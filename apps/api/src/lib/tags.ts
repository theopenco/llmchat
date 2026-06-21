// Shared tag helpers used by both the /tags route (create) and the conversation
// attach-by-name path, so dedupe + color assignment live in exactly one place.

import { db } from "@/lib/db";
import { colorForName, isHexColor } from "@/lib/tag-colors";

import { and, eq, sql, tag } from "@llmchat/db";

import type { AppContext } from "@/env";

type Env = AppContext["Bindings"];

export const TAG_NAME_MAX = 40;

/** A tag row as returned to clients. */
export interface TagRow {
	id: string;
	workspaceId: string;
	name: string;
	color: string | null;
	createdAt: Date;
}

/** Case-insensitive lookup of a tag by name within a workspace (matches the
 * COLLATE NOCASE unique index). */
export async function findTagByName(
	env: Env,
	workspaceId: string,
	name: string,
): Promise<TagRow | undefined> {
	const [row] = await db(env)
		.select()
		.from(tag)
		.where(
			and(
				eq(tag.workspaceId, workspaceId),
				sql`lower(${tag.name}) = ${name.toLowerCase()}`,
			),
		)
		.limit(1);
	return row;
}

/**
 * Find-or-create a workspace tag by name (case-insensitive). Dedupe is a no-op
 * that returns the existing tag — never a duplicate. A missing color is assigned
 * deterministically from the name; a provided hex color is honored, anything
 * else is ignored (falls back to the derived color).
 */
export async function findOrCreateTag(
	env: Env,
	workspaceId: string,
	rawName: string,
	color?: string | null,
): Promise<{ tag: TagRow; created: boolean }> {
	const name = rawName.trim();
	const existing = await findTagByName(env, workspaceId, name);
	if (existing) return { tag: existing, created: false };

	const resolvedColor = color && isHexColor(color) ? color : colorForName(name);
	const [created] = await db(env)
		.insert(tag)
		.values({ workspaceId, name, color: resolvedColor })
		.returning();
	return { tag: created!, created: true };
}
