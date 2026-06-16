import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { provisionWorkspace } from "@/lib/provisioning";
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
			const ws = await provisionWorkspace(db(c.env), userId, name);
			return c.json({ workspace: ws });
		},
	);
