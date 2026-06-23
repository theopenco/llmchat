import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit } from "@/lib/kv";
import { clientIp } from "@/lib/request";

import type { AppContext } from "@/env";

const messagesQuery = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
});

// The widget polls every ~2.5s (≈1440/h); leave headroom without allowing abuse.
const POLL_RATE_LIMIT_MAX = 4000;
const POLL_RATE_LIMIT_WINDOW = 60 * 60;

/**
 * Public message feed for the embedded widget, so admin replies show up
 * without a page refresh. Authorization model matches /v1/chat: knowing the
 * (public) project key plus the visitor's own client id scopes the read to
 * that visitor's single conversation.
 */
export const widgetMessages = new Hono<AppContext>().get(
	"/messages",
	zValidator("query", messagesQuery),
	async (c) => {
		const { projectKey, clientId } = c.req.valid("query");

		// Per-IP gate BEFORE the project lookup — bounds invalid-key DB floods.
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, projectKey),
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

		const rl = await rateLimit(
			c.env,
			`messages:${project.id}:${ip}`,
			POLL_RATE_LIMIT_MAX,
			POLL_RATE_LIMIT_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});
		if (!conv) {
			return c.json({ conversationId: null, csatRating: null, messages: [] });
		}

		const rows = await db(c.env).query.message.findMany({
			where: (mt, { eq: e }) => e(mt.conversationId, conv.id),
			orderBy: (mt, { asc }) => asc(mt.sequence),
		});
		// Conversation content: never cacheable by intermediaries.
		c.header("cache-control", "no-store");
		// The conversation id lets the widget address its own messages for
		// rating; it's the caller's own id, not another tenant's.
		// Only the fields the widget needs — no email ids, author ids, etc.
		return c.json({
			conversationId: conv.id,
			// Conversation-level CSAT so the widget never re-prompts a rated visitor.
			csatRating: conv.csatRating,
			messages: rows.map((m) => ({
				id: m.id,
				role: m.role,
				content: m.content,
				sequence: m.sequence,
				createdAt: m.createdAt,
				rating: m.rating,
			})),
		});
	},
);
