import { describe, expect, it } from "vitest";

import {
	addTagToConversation,
	dropConversationFromCache,
	flattenPages,
	mergeConversationPages,
	removeTagFromConversation,
	setConversationRead,
	type ConversationPage,
} from "./conversation-list";

import type { Conversation, Tag } from "./types";

const TAG: Tag = { id: "t1", name: "Billing", color: "#6366f1" };

function conv(overrides: Partial<Conversation> & { id: string }): Conversation {
	return {
		clientId: "c",
		name: null,
		email: null,
		ipAddress: null,
		userAgent: null,
		messageCount: 1,
		escalatedAt: null,
		archivedAt: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		csatRating: null,
		...overrides,
	};
}

function page(conversations: Conversation[]): ConversationPage {
	return { conversations, nextCursor: null };
}

function infinite(pages: ConversationPage[]) {
	return { pages, pageParams: [] as unknown[] };
}

describe("mergeConversationPages", () => {
	it("dedupes the head/page overlap (head wins) — no duplicate rows", () => {
		const head = [
			conv({ id: "a", updatedAt: "2026-06-16T10:00:00.000Z", unread: false }),
			conv({ id: "b", updatedAt: "2026-06-16T09:00:00.000Z" }),
		];
		// Page 1 overlaps the head and carries a STALE copy of "a" (still unread).
		const pageRows = [
			conv({ id: "a", updatedAt: "2026-06-16T08:00:00.000Z", unread: true }),
			conv({ id: "b", updatedAt: "2026-06-16T09:00:00.000Z" }),
			conv({ id: "c", updatedAt: "2026-06-16T07:00:00.000Z" }),
		];
		const merged = mergeConversationPages([head, pageRows]);
		// Each id appears exactly once.
		expect(merged.map((c) => c.id)).toEqual(["a", "b", "c"]);
		// The head's fresher "a" (read + newer updatedAt) wins over the stale page copy.
		expect(merged[0]).toMatchObject({ id: "a", unread: false });
	});

	it("sorts by (updatedAt desc, id desc) regardless of input order", () => {
		const rows = [
			conv({ id: "x", updatedAt: "2026-06-16T01:00:00.000Z" }),
			conv({ id: "z", updatedAt: "2026-06-16T03:00:00.000Z" }),
			// Same timestamp as z → id desc breaks the tie (z before y).
			conv({ id: "y", updatedAt: "2026-06-16T03:00:00.000Z" }),
		];
		expect(mergeConversationPages([rows]).map((c) => c.id)).toEqual([
			"z",
			"y",
			"x",
		]);
	});

	it("ignores undefined sources (head not loaded yet)", () => {
		const pageRows = [conv({ id: "a" })];
		expect(
			mergeConversationPages([undefined, pageRows]).map((c) => c.id),
		).toEqual(["a"]);
	});
});

describe("flattenPages", () => {
	it("flattens an infinite cache's pages into one list", () => {
		const data = infinite([
			page([conv({ id: "a" }), conv({ id: "b" })]),
			page([conv({ id: "c" })]),
		]);
		expect(flattenPages(data).map((c) => c.id)).toEqual(["a", "b", "c"]);
		expect(flattenPages(undefined)).toEqual([]);
	});
});

describe("dropConversationFromCache (shape-aware)", () => {
	it("removes from the head cache shape ({ conversations })", () => {
		const prev = page([conv({ id: "a" }), conv({ id: "b" })]);
		const next = dropConversationFromCache(prev, "a") as ConversationPage;
		expect(next.conversations.map((c) => c.id)).toEqual(["b"]);
	});

	it("removes from EVERY page of the infinite cache shape ({ pages })", () => {
		const prev = infinite([
			page([conv({ id: "a" }), conv({ id: "b" })]),
			page([conv({ id: "a" }), conv({ id: "c" })]), // dup id across pages
		]);
		const next = dropConversationFromCache(prev, "a") as ReturnType<
			typeof infinite
		>;
		expect(next.pages[0].conversations.map((c) => c.id)).toEqual(["b"]);
		expect(next.pages[1].conversations.map((c) => c.id)).toEqual(["c"]);
	});

	it("passes unknown shapes / undefined through unchanged", () => {
		expect(dropConversationFromCache(undefined, "a")).toBeUndefined();
		expect(dropConversationFromCache({ nope: 1 }, "a")).toEqual({ nope: 1 });
	});
});

describe("setConversationRead (shape-aware)", () => {
	it("clears unread for one id across both cache shapes", () => {
		const head = page([
			conv({ id: "a", unread: true }),
			conv({ id: "b", unread: true }),
		]);
		const nextHead = setConversationRead(head, "a") as ConversationPage;
		expect(nextHead.conversations[0]).toMatchObject({ id: "a", unread: false });
		expect(nextHead.conversations[1]).toMatchObject({ id: "b", unread: true });

		const inf = infinite([page([conv({ id: "a", unread: true })])]);
		const nextInf = setConversationRead(inf, "a") as ReturnType<
			typeof infinite
		>;
		expect(nextInf.pages[0].conversations[0]).toMatchObject({
			id: "a",
			unread: false,
		});
	});
});

describe("addTagToConversation / removeTagFromConversation (shape-aware)", () => {
	it("attaches a tag to the right conversation across both cache shapes", () => {
		const head = page([conv({ id: "a" }), conv({ id: "b" })]);
		const nextHead = addTagToConversation(head, "a", TAG) as ConversationPage;
		expect(nextHead.conversations[0]!.tags).toEqual([TAG]);
		expect(nextHead.conversations[1]!.tags ?? []).toEqual([]);

		const inf = infinite([page([conv({ id: "a" })])]);
		const nextInf = addTagToConversation(inf, "a", TAG) as ReturnType<
			typeof infinite
		>;
		expect(nextInf.pages[0].conversations[0]!.tags).toEqual([TAG]);
	});

	it("is idempotent — attaching an already-present tag is a no-op", () => {
		const head = page([conv({ id: "a", tags: [TAG] })]);
		const next = addTagToConversation(head, "a", TAG) as ConversationPage;
		expect(next.conversations[0]!.tags).toEqual([TAG]);
	});

	it("removes a tag by id, leaving the others", () => {
		const other: Tag = { id: "t2", name: "VIP", color: null };
		const head = page([conv({ id: "a", tags: [TAG, other] })]);
		const next = removeTagFromConversation(head, "a", "t1") as ConversationPage;
		expect(next.conversations[0]!.tags).toEqual([other]);
	});

	it("passes unknown shapes / undefined through unchanged", () => {
		expect(addTagToConversation(undefined, "a", TAG)).toBeUndefined();
		expect(removeTagFromConversation({ nope: 1 }, "a", "t1")).toEqual({
			nope: 1,
		});
	});
});
