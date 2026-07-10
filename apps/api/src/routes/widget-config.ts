import { Hono } from "hono";

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/plan";

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
			columns: {
				workspaceId: true,
				privacyPolicyUrl: true,
				suggestedQuestions: true,
			},
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		// Branding follows the resolved tier: exempt/internal and Growth/Scale
		// suppress the badge; Starter (and unpaid) show it.
		const { entitlements } = await resolveAccess(c.env, project.workspaceId);
		return c.json({
			showBranding: entitlements.branding === "badge",
			// Null → the widget links its privacy notice to its built-in default.
			privacyPolicyUrl: project.privacyPolicyUrl ?? null,
			// Starter-question chips the widget offers before the first message.
			// Guarded: a malformed/legacy column value degrades to no chips.
			suggestedQuestions: Array.isArray(project.suggestedQuestions)
				? project.suggestedQuestions.filter((q) => typeof q === "string")
				: [],
		});
	},
);
