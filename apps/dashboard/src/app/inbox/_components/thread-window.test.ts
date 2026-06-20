import { describe, expect, it } from "vitest";

import {
	appendNewer,
	maxSequence,
	minSequence,
	prependOlder,
	threadParams,
	toWindow,
	type ThreadResponse,
	type ThreadWindow,
} from "./thread-window";

import type { Conversation, Message } from "./types";

function msg(seq: number, overrides: Partial<Message> = {}): Message {
	return {
		id: `m${seq}`,
		role: "user",
		content: `line ${seq}`,
		sequence: seq,
		createdAt: "2026-06-16T05:00:00.000Z",
		...overrides,
	};
}

const CONV = { id: "c1", csatRating: null } as Conversation;

function res(
	messages: Message[],
	extra: Partial<ThreadResponse> = {},
): ThreadResponse {
	return { conversation: CONV, messages, hasOlder: false, ...extra };
}

function window(
	messages: Message[],
	extra: Partial<ThreadWindow> = {},
): ThreadWindow {
	return {
		conversation: CONV,
		messages,
		hasOlder: false,
		firstHitSequence: null,
		...extra,
	};
}

describe("threadParams", () => {
	it("poll (after) requests NEWEST-ONLY — no limit/before/search", () => {
		expect(threadParams({ after: 42 })).toBe("after=42");
	});

	it("older page sends before + limit", () => {
		const p = new URLSearchParams(threadParams({ before: 51, limit: 50 }));
		expect(p.get("before")).toBe("51");
		expect(p.get("limit")).toBe("50");
		expect(p.get("after")).toBeNull();
	});

	it("latest page sends just the limit; search adds the term", () => {
		expect(threadParams({})).toBe("limit=50");
		const p = new URLSearchParams(threadParams({ search: "refund" }));
		expect(p.get("search")).toBe("refund");
		expect(p.get("before")).toBeNull();
	});
});

describe("min/max sequence", () => {
	it("reads the ends of an ascending window", () => {
		const m = [msg(3), msg(7), msg(9)];
		expect(minSequence(m)).toBe(3);
		expect(maxSequence(m)).toBe(9);
		expect(minSequence([])).toBeNull();
		expect(maxSequence([])).toBeNull();
	});
});

describe("appendNewer (poll merge)", () => {
	it("appends newer messages, refreshes the conversation, keeps order + no dupes", () => {
		const prev = window([msg(1), msg(2)], {
			hasOlder: true,
			firstHitSequence: 1,
		});
		const next = appendNewer(
			prev,
			res([msg(2), msg(3)], { conversation: { ...CONV, csatRating: 5 } }),
		)!;
		// 2 is deduped; 3 appended; ascending.
		expect(next.messages.map((m) => m.sequence)).toEqual([1, 2, 3]);
		// Conversation refreshed (csat now set), but window edges untouched.
		expect(next.conversation.csatRating).toBe(5);
		expect(next.hasOlder).toBe(true);
		expect(next.firstHitSequence).toBe(1);
	});

	it("is undefined-safe", () => {
		expect(appendNewer(undefined, res([msg(1)]))).toBeUndefined();
	});
});

describe("prependOlder (load-older merge)", () => {
	it("prepends older messages and adopts the page's hasOlder; keeps the newest id", () => {
		const prev = window([msg(51), msg(52)], {
			hasOlder: true,
			firstHitSequence: 10,
		});
		const next = prependOlder(
			prev,
			res([msg(49), msg(50)], { hasOlder: false }),
		)!;
		expect(next.messages.map((m) => m.sequence)).toEqual([49, 50, 51, 52]);
		// The last (newest) message is unchanged — so stick-to-bottom won't react.
		expect(next.messages.at(-1)!.id).toBe("m52");
		expect(next.hasOlder).toBe(false);
		expect(next.firstHitSequence).toBe(10);
	});
});

describe("toWindow", () => {
	it("sorts and carries hasOlder + firstHitSequence", () => {
		const w = toWindow(
			res([msg(3), msg(1), msg(2)], { hasOlder: true, firstHitSequence: 2 }),
		);
		expect(w.messages.map((m) => m.sequence)).toEqual([1, 2, 3]);
		expect(w.hasOlder).toBe(true);
		expect(w.firstHitSequence).toBe(2);
	});
});
