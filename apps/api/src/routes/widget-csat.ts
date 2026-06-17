import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/kv";
import { clientIp } from "@/lib/request";

import { conversation, eq } from "@llmchat/db";

import type { AppContext } from "@/env";

// `null` clears; 1–5 sets the star rating. Out-of-range / non-integer → 400.
const csatBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	conversationId: z.string().max(128),
	rating: z.union([z.number().int().min(1).max(5), z.null()]),
});

const CSAT_RATE_LIMIT_MAX = 60;
const CSAT_RATE_LIMIT_WINDOW = 60 * 60;

/**
 * Public end-of-conversation CSAT for the embedded widget. Same posture as
 * /v1/chat and /v1/rating: anonymous, CORS-open, scoped by the (public) project
 * key plus the visitor's own client id.
 *
 * Validates the ownership chain before writing so a visitor can only rate their
 * OWN conversation: project(publicKey) → conversation(id, projectId, clientId).
 * A broken link is rejected (404); the rating is conversation-level (distinct
 * from per-message thumbs).
 */
export const widgetCsat = new Hono<AppContext>().post(
	"/csat",
	zValidator("json", csatBody),
	async (c) => {
		const { projectKey, clientId, conversationId, rating } =
			c.req.valid("json");

		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, projectKey),
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

		const rl = await rateLimit(
			c.env,
			`csat:${project.id}:${clientIp(c)}`,
			CSAT_RATE_LIMIT_MAX,
			CSAT_RATE_LIMIT_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		// The conversation must belong to this project AND this caller's clientId.
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(
					e(ct.id, conversationId),
					e(ct.projectId, project.id),
					e(ct.clientId, clientId),
				),
		});
		if (!conv) {
			return c.json({ error: "not found" }, 404);
		}

		await db(c.env)
			.update(conversation)
			.set({ csatRating: rating })
			.where(eq(conversation.id, conv.id));

		return c.json({ ok: true });
	},
);
