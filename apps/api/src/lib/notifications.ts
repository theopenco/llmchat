/**
 * Notification feed — pure shaping/merge logic, split from the route so it can be
 * unit-tested without a DB. The route runs three bounded, workspace-scoped queries
 * (new conversations, escalations, new visitor messages) and hands the rows here to
 * be normalized into one time-sorted, deduped, capped feed for the dashboard bell.
 */

export type NotificationType = "conversation" | "escalation" | "message";

export interface NotificationItem {
	/** Stable id (`<type>:<sourceId>`) so the client can dedupe across polls and
	 * compute the unread count against a stored "last seen" timestamp. */
	id: string;
	type: NotificationType;
	conversationId: string;
	projectId: string;
	/** Visitor name; null when anonymous (the client renders "Anonymous"). */
	title: string | null;
	/** Short human-readable line for the row. */
	preview: string;
	/** ISO timestamp of the underlying event. */
	createdAt: string;
}

/** Row shapes as selected by the route (timestamps are Drizzle `Date`s). */
export interface ConversationStartRow {
	id: string;
	projectId: string;
	name: string | null;
	createdAt: Date;
}
export interface EscalationRow {
	id: string;
	projectId: string;
	name: string | null;
	escalatedAt: Date;
}
export interface VisitorMessageRow {
	id: string;
	conversationId: string;
	projectId: string;
	name: string | null;
	content: string;
	createdAt: Date;
}

/** Clamp a message body to a single readable preview line. */
export function messagePreview(content: string, max = 120): string {
	const oneLine = content.replace(/\s+/g, " ").trim();
	return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Merge the three event sources into one feed: newest first, capped at `limit`.
 * Ids are stable per source row, so re-polling never produces duplicate entries
 * even as the same conversation surfaces across multiple event types.
 */
export function buildNotificationFeed(inputs: {
	conversations: ConversationStartRow[];
	escalations: EscalationRow[];
	messages: VisitorMessageRow[];
	limit: number;
}): NotificationItem[] {
	const items: NotificationItem[] = [];

	for (const c of inputs.conversations) {
		items.push({
			id: `conversation:${c.id}`,
			type: "conversation",
			conversationId: c.id,
			projectId: c.projectId,
			title: c.name,
			preview: "Started a new conversation",
			createdAt: c.createdAt.toISOString(),
		});
	}

	for (const e of inputs.escalations) {
		items.push({
			id: `escalation:${e.id}`,
			type: "escalation",
			conversationId: e.id,
			projectId: e.projectId,
			title: e.name,
			preview: "Asked to talk to a human",
			createdAt: e.escalatedAt.toISOString(),
		});
	}

	for (const m of inputs.messages) {
		items.push({
			id: `message:${m.id}`,
			type: "message",
			conversationId: m.conversationId,
			projectId: m.projectId,
			title: m.name,
			preview: messagePreview(m.content),
			createdAt: m.createdAt.toISOString(),
		});
	}

	// Newest first; tie-break on id for a stable, deterministic order.
	items.sort(
		(a, b) =>
			b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
	);

	return items.slice(0, inputs.limit);
}
