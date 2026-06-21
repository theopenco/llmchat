import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { TAG_NAME_MAX, findOrCreateTag } from "@/lib/tags";
import { requireSession, requireWorkspace } from "@/middleware/session";

import { conversationTag, count, eq, sql, tag as tagTable } from "@llmchat/db";

import type { AppContext } from "@/env";

const createInput = z.object({
	name: z.string().trim().min(1).max(TAG_NAME_MAX),
	color: z.string().max(32).optional(),
});

// Any workspace member can manage tags (same posture as the reply route — no
// requireRole). Strictly workspace-scoped via requireWorkspace + the x-workspace
// header, so a tag from another workspace is never visible or mutable here.
export const tags = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/tags", async (c) => {
		const workspaceId = c.get("workspaceId");
		// Tags for this workspace, each with how many conversations carry it — one
		// grouped LEFT JOIN aggregate (so a brand-new tag reports 0, not missing).
		const rows = await db(c.env)
			.select({
				id: tagTable.id,
				workspaceId: tagTable.workspaceId,
				name: tagTable.name,
				color: tagTable.color,
				createdAt: tagTable.createdAt,
				count: count(conversationTag.id),
			})
			.from(tagTable)
			.leftJoin(conversationTag, eq(conversationTag.tagId, tagTable.id))
			.where(eq(tagTable.workspaceId, workspaceId))
			.groupBy(tagTable.id)
			.orderBy(sql`lower(${tagTable.name})`);
		return c.json({ tags: rows });
	})
	.post("/tags", zValidator("json", createInput), async (c) => {
		const workspaceId = c.get("workspaceId");
		const { name, color } = c.req.valid("json");
		// Dedupe is case-insensitive: a matching tag (any casing) is returned as-is
		// rather than creating a second row.
		const { tag, created } = await findOrCreateTag(
			c.env,
			workspaceId,
			name,
			color,
		);
		return c.json({ tag, created });
	});
