import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireSession } from "@/middleware/session";

import { eq, member, workspace } from "@llmchat/db";

import type { AppContext } from "@/env";

export const workspaces = new Hono<AppContext>()
	.use("*", requireSession)
	.get("/workspaces", async (c) => {
		const userId = c.get("userId");
		const rows = await db(c.env)
			.select({ workspace: workspace, role: member.role })
			.from(member)
			.innerJoin(workspace, eq(workspace.id, member.workspaceId))
			.where(eq(member.userId, userId));
		return c.json({ workspaces: rows });
	})
	.post(
		"/workspaces",
		zValidator("json", z.object({ name: z.string().min(1) })),
		async (c) => {
			const userId = c.get("userId");
			const { name } = c.req.valid("json");
			const [ws] = await db(c.env)
				.insert(workspace)
				.values({ name, ownerId: userId })
				.returning();
			await db(c.env)
				.insert(member)
				.values({ workspaceId: ws!.id, userId, role: "owner" });
			return c.json({ workspace: ws });
		},
	);
