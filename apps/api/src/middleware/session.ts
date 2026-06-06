import { createMiddleware } from "hono/factory";

import { createAuth } from "@/auth";
import { db } from "@/lib/db";

import { eq, member } from "@llmchat/db";

import type { AppContext } from "@/env";

export const requireSession = createMiddleware<AppContext>(async (c, next) => {
	const auth = createAuth(c.env);
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ error: "unauthorized" }, 401);
	}
	c.set("userId", session.user.id);
	return next();
});

export const requireWorkspace = createMiddleware<AppContext>(
	async (c, next) => {
		const userId = c.get("userId");
		const workspaceId = c.req.header("x-workspace-id");
		if (!workspaceId) {
			return c.json({ error: "workspace required" }, 400);
		}
		const m = await db(c.env).query.member.findFirst({
			where: (mt, { and, eq: e }) =>
				and(e(mt.userId, userId), e(mt.workspaceId, workspaceId)),
		});
		if (!m) {
			return c.json({ error: "forbidden" }, 403);
		}
		c.set("workspaceId", workspaceId);
		return next();
	},
);
