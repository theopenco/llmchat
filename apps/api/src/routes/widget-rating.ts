import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/kv";
import { clientIp } from "@/lib/request";

import { eq, message as messageTable } from "@llmchat/db";

import type { AppContext } from "@/env";

// `null` clears the rating; "up"/"down" set it. Last-write-wins on one column.
const ratingBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	conversationId: z.string().max(128),
	messageId: z.string().max(128),
	rating: z.union([z.literal("up"), z.literal("down"), z.null()]),
});

// Visitors toggle freely; keep a generous budget that still caps abuse.
const RATING_RATE_LIMIT_MAX = 240;
const RATING_RATE_LIMIT_WINDOW = 60 * 60;

/**
 * Public per-message rating for the embedded widget. Same posture as
 * /v1/chat and /v1/messages: anonymous, CORS-open, scoped by the (public)
 * project key plus the visitor's own client id.
 *
 * Before writing, the full ownership chain is validated so a visitor can only
 * ever rate an assistant message in their OWN conversation:
 *   project(publicKey) → conversation(id, projectId, clientId) → message(id, conversationId, assistant)
 * Any broken link is rejected (404), and non-assistant messages aren't rateable (400).
 */
export const widgetRating = new Hono<AppContext>().post(
	"/rating",
	zValidator("json", ratingBody),
	async (c) => {
		const { projectKey, clientId, conversationId, messageId, rating } =
			c.req.valid("json");

		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, projectKey),
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

		const rl = await rateLimit(
			c.env,
			`rating:${project.id}:${clientIp(c)}`,
			RATING_RATE_LIMIT_MAX,
			RATING_RATE_LIMIT_WINDOW,
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

		// The message must belong to that conversation.
		const msg = await db(c.env).query.message.findFirst({
			where: (mt, { and: a, eq: e }) =>
				a(e(mt.id, messageId), e(mt.conversationId, conv.id)),
		});
		if (!msg) {
			return c.json({ error: "not found" }, 404);
		}
		if (msg.role !== "assistant") {
			return c.json({ error: "only assistant messages are rateable" }, 400);
		}

		await db(c.env)
			.update(messageTable)
			.set({ rating })
			.where(eq(messageTable.id, msg.id));

		return c.json({ ok: true });
	},
);
