import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { isPaletteColor } from "@/lib/tag-colors";
import {
	TAG_NAME_MAX,
	findOrCreateTag,
	findTagByNameExcluding,
} from "@/lib/tags";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import { conversationTag, count, eq, sql, tag as tagTable } from "@llmchat/db";

import type { AppContext } from "@/env";

const createInput = z.object({
	name: z.string().trim().min(1).max(TAG_NAME_MAX),
	color: z.string().max(32).optional(),
});

// UPDATE: every field optional, NO `.default()`/`.partial()` (the Zod-v4 footgun
// where a default fires on an absent key and clobbers the sibling) — a PATCH with
// only `color` must not blank `name`, and vice versa. `color` is restricted to
// the fixed palette (stricter than create); at least one field must be present.
const updateInput = z
	.object({
		name: z.string().trim().min(1).max(TAG_NAME_MAX).optional(),
		color: z
			.string()
			.refine(isPaletteColor, { message: "color must be one of the palette" })
			.optional(),
	})
	.refine((d) => d.name !== undefined || d.color !== undefined, {
		message: "name or color required",
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
	})
	// Rename / recolor a tag. Admin+ (create/assign stay open to any member).
	.patch(
		"/tags/:tagId",
		requireRole("admin"),
		zValidator("json", updateInput),
		async (c) => {
			const { tagId } = c.req.param();
			const workspaceId = c.get("workspaceId");
			const { name, color } = c.req.valid("json");

			// Tenant: the tag must belong to the caller's workspace (else 404 — no
			// cross-workspace rename, no existence leak).
			const existing = await db(c.env).query.tag.findFirst({
				where: (t, { and, eq: e }) =>
					and(e(t.id, tagId), e(t.workspaceId, workspaceId)),
			});
			if (!existing) return c.json({ error: "not found" }, 404);

			// Rename collision: a DIFFERENT tag with the same name (case-insensitive)
			// ⇒ 409, no change. Renaming to the tag's own current name/casing is fine
			// (the exclude-self lookup returns nothing).
			if (name !== undefined) {
				const collision = await findTagByNameExcluding(
					c.env,
					workspaceId,
					name,
					tagId,
				);
				if (collision) {
					return c.json({ error: "name already exists" }, 409);
				}
			}

			// Only the provided fields are written — a color-only PATCH never blanks
			// name, and vice versa (the updateInput carries no defaults).
			const data: { name?: string; color?: string } = {};
			if (name !== undefined) data.name = name.trim();
			if (color !== undefined) data.color = color;

			const [updated] = await db(c.env)
				.update(tagTable)
				.set(data)
				.where(eq(tagTable.id, tagId))
				.returning();
			return c.json({ tag: updated });
		},
	)
	// Delete a tag. The 0013 cascade FK removes its conversation_tag rows. Admin+.
	.delete("/tags/:tagId", requireRole("admin"), async (c) => {
		const { tagId } = c.req.param();
		const workspaceId = c.get("workspaceId");
		const existing = await db(c.env).query.tag.findFirst({
			where: (t, { and, eq: e }) =>
				and(e(t.id, tagId), e(t.workspaceId, workspaceId)),
		});
		if (!existing) return c.json({ error: "not found" }, 404);
		await db(c.env).delete(tagTable).where(eq(tagTable.id, tagId));
		return c.json({ ok: true });
	});
