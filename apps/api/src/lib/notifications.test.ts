import { describe, expect, it } from "vitest";

import { buildNotificationFeed, messagePreview } from "./notifications";

const d = (iso: string) => new Date(iso);

describe("messagePreview", () => {
	it("collapses whitespace and trims", () => {
		expect(messagePreview("  hello \n  world  ")).toBe("hello world");
	});

	it("truncates long bodies with an ellipsis", () => {
		expect(messagePreview("x".repeat(200), 10)).toBe(`${"x".repeat(9)}…`);
	});
});

describe("buildNotificationFeed", () => {
	it("merges all three sources, newest first", () => {
		const feed = buildNotificationFeed({
			conversations: [
				{
					id: "c1",
					projectId: "p1",
					name: "Ann",
					createdAt: d("2026-01-01T10:00:00Z"),
				},
			],
			escalations: [
				{
					id: "c1",
					projectId: "p1",
					name: "Ann",
					escalatedAt: d("2026-01-01T12:00:00Z"),
				},
			],
			messages: [
				{
					id: "m1",
					conversationId: "c1",
					projectId: "p1",
					name: "Ann",
					content: "help me",
					createdAt: d("2026-01-01T11:00:00Z"),
				},
			],
			limit: 30,
		});
		expect(feed.map((n) => n.id)).toEqual([
			"escalation:c1",
			"message:m1",
			"conversation:c1",
		]);
		expect(feed[1].preview).toBe("help me");
	});

	it("gives each source a stable, type-prefixed id", () => {
		const feed = buildNotificationFeed({
			conversations: [
				{
					id: "c1",
					projectId: "p1",
					name: null,
					createdAt: d("2026-01-01T10:00:00Z"),
				},
			],
			escalations: [],
			messages: [],
			limit: 30,
		});
		expect(feed[0].id).toBe("conversation:c1");
		expect(feed[0].title).toBeNull();
	});

	it("caps the feed at the limit", () => {
		const messages = Array.from({ length: 40 }, (_, i) => ({
			id: `m${i}`,
			conversationId: "c1",
			projectId: "p1",
			name: "Ann",
			content: `msg ${i}`,
			createdAt: d(`2026-01-01T10:${String(i).padStart(2, "0")}:00Z`),
		}));
		const feed = buildNotificationFeed({
			conversations: [],
			escalations: [],
			messages,
			limit: 30,
		});
		expect(feed).toHaveLength(30);
		// Newest first: m39 leads.
		expect(feed[0].id).toBe("message:m39");
	});
});
