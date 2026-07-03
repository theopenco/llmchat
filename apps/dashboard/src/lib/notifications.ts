import { api } from "./api";

/** One feed entry from `GET /api/notifications` (mirrors the api's
 * NotificationItem). `title` is the visitor name, null when anonymous. */
export interface NotificationItem {
	id: string;
	type: "conversation" | "escalation" | "message";
	conversationId: string;
	projectId: string;
	title: string | null;
	preview: string;
	createdAt: string;
}

export interface NotificationsResponse {
	notifications: NotificationItem[];
}

export const NOTIFICATIONS_KEY = (workspaceId: string) =>
	["notifications", workspaceId] as const;

export function fetchNotifications(workspaceId: string) {
	return api<NotificationsResponse>("/api/notifications", { workspaceId });
}

/** localStorage key for the per-workspace "last seen" watermark. Scoped by
 * workspace so switching workspaces reads the right badge count. */
function lastSeenKey(workspaceId: string) {
	return `ck:notifications:lastSeen:${workspaceId}`;
}

/** Read the stored watermark (ISO string). Missing / SSR ⇒ epoch, so a
 * first-time user sees everything in the window as unread. */
export function getLastSeen(workspaceId: string): string {
	if (typeof window === "undefined") return new Date(0).toISOString();
	try {
		return (
			window.localStorage.getItem(lastSeenKey(workspaceId)) ??
			new Date(0).toISOString()
		);
	} catch {
		return new Date(0).toISOString();
	}
}

export function setLastSeen(workspaceId: string, iso: string): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(lastSeenKey(workspaceId), iso);
	} catch {
		/* storage blocked (private mode) — badge just won't persist. */
	}
}

/** How many feed items are newer than the watermark. Pure so it's unit-tested. */
export function countUnread(
	items: NotificationItem[],
	lastSeenIso: string,
): number {
	return items.filter((n) => n.createdAt > lastSeenIso).length;
}

/** The newest event time in the feed, or null when empty — used as the new
 * watermark when the panel is opened. */
export function newestTimestamp(items: NotificationItem[]): string | null {
	let newest: string | null = null;
	for (const n of items) {
		if (newest === null || n.createdAt > newest) newest = n.createdAt;
	}
	return newest;
}
