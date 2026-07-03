import { Hono } from "hono";

import { db } from "@/lib/db";
import { buildNotificationFeed } from "@/lib/notifications";
import { requireSession, requireWorkspace } from "@/middleware/session";

import {
	and,
	conversation,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	message as messageTable,
	project as projectTable,
	sql,
} from "@llmchat/db";

import type { AppContext } from "@/env";

/** How far back the feed looks, and how many rows to keep. Bounds every scan so
 * the endpoint stays O(window) regardless of total history. */
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const FEED_LIMIT = 30;
/** Per-source fetch cap before the merge — a little headroom over FEED_LIMIT so a
 * burst of one event type can't starve the others out of the final feed. */
const PER_SOURCE_LIMIT = 50;

/**
 * Workspace-wide notification feed for the dashboard bell: new conversation
 * starts, escalations, and new visitor messages across every project the caller's
 * workspace owns. Read-only; "unread" is tracked client-side against a stored
 * last-seen timestamp (no per-user write path here — keeps it a pure read that can
 * poll cheaply, like the inbox head query).
 */
export const notifications = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/notifications", async (c) => {
		const workspaceId = c.get("workspaceId");
		const database = db(c.env);

		// Scope to this workspace's projects. No projects ⇒ empty feed (skip the
		// event scans entirely).
		const projects = await database
			.select({ id: projectTable.id })
			.from(projectTable)
			.where(eq(projectTable.workspaceId, workspaceId));
		const projectIds = projects.map((p) => p.id);
		if (projectIds.length === 0) {
			return c.json({ notifications: [] });
		}

		const sinceUnix = Math.floor((Date.now() - WINDOW_MS) / 1000);

		// Three bounded, project-scoped scans, merged in-app. Kept as separate
		// queries (not one UNION) so each stays a plain indexed lookup and the
		// shaping/merge is the unit-tested pure function in lib/notifications.
		const [starts, escalations, messages] = await Promise.all([
			database
				.select({
					id: conversation.id,
					projectId: conversation.projectId,
					name: conversation.name,
					createdAt: conversation.createdAt,
				})
				.from(conversation)
				.where(
					and(
						inArray(conversation.projectId, projectIds),
						gte(conversation.createdAt, new Date(sinceUnix * 1000)),
					),
				)
				.orderBy(desc(conversation.createdAt))
				.limit(PER_SOURCE_LIMIT),

			database
				.select({
					id: conversation.id,
					projectId: conversation.projectId,
					name: conversation.name,
					escalatedAt: conversation.escalatedAt,
				})
				.from(conversation)
				.where(
					and(
						inArray(conversation.projectId, projectIds),
						isNotNull(conversation.escalatedAt),
						gte(conversation.escalatedAt, new Date(sinceUnix * 1000)),
					),
				)
				.orderBy(desc(conversation.escalatedAt))
				.limit(PER_SOURCE_LIMIT),

			// New visitor messages: role='user' and sequence > 1 so the opening
			// message (already surfaced as a "new conversation" event) isn't counted
			// twice. Joined to conversation for the project scope + visitor name.
			database
				.select({
					id: messageTable.id,
					conversationId: messageTable.conversationId,
					projectId: conversation.projectId,
					name: conversation.name,
					content: messageTable.content,
					createdAt: messageTable.createdAt,
				})
				.from(messageTable)
				.innerJoin(
					conversation,
					eq(messageTable.conversationId, conversation.id),
				)
				.where(
					and(
						inArray(conversation.projectId, projectIds),
						eq(messageTable.role, "user"),
						sql`${messageTable.sequence} > 1`,
						gte(messageTable.createdAt, new Date(sinceUnix * 1000)),
					),
				)
				.orderBy(desc(messageTable.createdAt))
				.limit(PER_SOURCE_LIMIT),
		]);

		const feed = buildNotificationFeed({
			conversations: starts,
			escalations: escalations.map((e) => ({
				id: e.id,
				projectId: e.projectId,
				name: e.name,
				// escalatedAt is non-null here (isNotNull predicate above).
				escalatedAt: e.escalatedAt as Date,
			})),
			messages,
			limit: FEED_LIMIT,
		});

		return c.json({ notifications: feed });
	});
