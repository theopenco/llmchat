import { Hono } from "hono";

import { db } from "@/lib/db";
import { workspacePlan } from "@/lib/plan";

import { showPoweredByBadge } from "@llmchat/shared";

import type { AppContext } from "@/env";

/**
 * Public, server-authoritative widget config for a live embed. The only field
 * that can't live in the embed snippet's data attributes is branding: whether
 * the "Powered by" badge shows is decided by the owning workspace's plan, not
 * by the customer's markup, so a customer can't strip the badge by editing the
 * snippet. The widget fetches this on mount.
 */
export const widgetConfig = new Hono<AppContext>().get(
	"/config/:key",
	async (c) => {
		const key = c.req.param("key");
		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, key),
			columns: { workspaceId: true },
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		const plan = await workspacePlan(c.env, project.workspaceId);
		return c.json({ showBranding: showPoweredByBadge(plan) });
	},
);
