import { beforeEach, describe, expect, it } from "vitest";

import {
	countUnread,
	getLastSeen,
	newestTimestamp,
	setLastSeen,
	type NotificationItem,
} from "./notifications";

const item = (id: string, createdAt: string): NotificationItem => ({
	id,
	type: "message",
	conversationId: "c1",
	projectId: "p1",
	title: "Ann",
	preview: "hi",
	createdAt,
});

describe("countUnread", () => {
	it("counts only items strictly newer than the watermark", () => {
		const items = [
			item("a", "2026-01-01T10:00:00.000Z"),
			item("b", "2026-01-01T12:00:00.000Z"),
			item("c", "2026-01-01T14:00:00.000Z"),
		];
		expect(countUnread(items, "2026-01-01T11:00:00.000Z")).toBe(2);
		expect(countUnread(items, "2026-01-01T14:00:00.000Z")).toBe(0);
		expect(countUnread(items, new Date(0).toISOString())).toBe(3);
	});
});

describe("newestTimestamp", () => {
	it("returns the max createdAt", () => {
		expect(
			newestTimestamp([
				item("a", "2026-01-01T10:00:00.000Z"),
				item("b", "2026-01-01T14:00:00.000Z"),
				item("c", "2026-01-01T12:00:00.000Z"),
			]),
		).toBe("2026-01-01T14:00:00.000Z");
	});

	it("returns null for an empty feed", () => {
		expect(newestTimestamp([])).toBeNull();
	});
});

describe("last-seen storage", () => {
	beforeEach(() => window.localStorage.clear());

	it("defaults to epoch when unset", () => {
		expect(getLastSeen("ws1")).toBe(new Date(0).toISOString());
	});

	it("round-trips per workspace", () => {
		setLastSeen("ws1", "2026-01-01T10:00:00.000Z");
		expect(getLastSeen("ws1")).toBe("2026-01-01T10:00:00.000Z");
		// A different workspace keeps its own watermark.
		expect(getLastSeen("ws2")).toBe(new Date(0).toISOString());
	});
});
