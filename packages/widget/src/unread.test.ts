import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	BACKGROUND_POLL_INTERVAL_MS,
	badgeLabel,
	clearSnapshot,
	countUnread,
	latestSequence,
	launcherLabel,
	readSnapshot,
	sameSnapshot,
	shouldPollInBackground,
	writeSnapshot,
} from "./unread";
import { widgetStyles } from "./styles";
import { POLL_INTERVAL_MS } from "./useServerMessages";

import type { ConversationSnapshot } from "./unread";
import type { ServerMessage } from "./messages-sync";

function msg(
	sequence: number,
	role: string,
	content = `msg ${sequence}`,
): ServerMessage {
	return { id: `m${sequence}`, role, content, sequence, createdAt: sequence };
}

function snapshot(
	over: Partial<ConversationSnapshot> = {},
): ConversationSnapshot {
	return {
		clientId: "c1",
		conversationId: "conv1",
		escalated: false,
		resolved: false,
		lastSeenSequence: 0,
		...over,
	};
}

beforeEach(() => {
	sessionStorage.clear();
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("countUnread", () => {
	it("counts only what the panel will actually render as somebody else's message", () => {
		const feed = [
			msg(1, "user"),
			msg(2, "assistant"),
			msg(3, "system", "Visitor requested a human operator"),
			msg(4, "user"), // the visitor's own reply (e.g. arrived by inbound email)
			msg(5, "admin", "Hi, this is Luca — looking now"),
		];
		// Everything past the marker, minus the visitor's own turns.
		expect(countUnread(feed, 1)).toBe(3); // assistant + system + admin
		expect(countUnread(feed, 3)).toBe(1); // just the admin reply
		expect(countUnread(feed, 5)).toBe(0);
	});

	it("never counts the visitor's own messages — sending doesn't badge yourself", () => {
		expect(countUnread([msg(1, "user"), msg(2, "user")], 0)).toBe(0);
	});

	it("ignores empty rows, which MessageList doesn't render either", () => {
		expect(countUnread([msg(1, "assistant", "")], 0)).toBe(0);
	});

	it("survives a marker ahead of the feed (rows deleted from the inbox)", () => {
		expect(countUnread([msg(1, "admin")], 99)).toBe(0);
	});

	it("is exact across the sequence gap a hidden internal note leaves (#146)", () => {
		// Server-side: user=7, note=8 (never served to visitors), assistant=9.
		// The feed arrives with a hole at 8; the high-water marker sits on the
		// visitor's own 7. Exactly one unread — the gap neither hides the
		// assistant reply nor phantom-counts the invisible note.
		const gapped = [msg(7, "user"), msg(9, "assistant")];
		expect(countUnread(gapped, 7)).toBe(1);
		expect(latestSequence(gapped)).toBe(9);
		// Adopting the head as the new marker clears the badge across the gap.
		expect(countUnread(gapped, latestSequence(gapped))).toBe(0);
	});
});

describe("latestSequence", () => {
	it("is 0 for an empty feed and the head otherwise", () => {
		expect(latestSequence([])).toBe(0);
		expect(
			latestSequence([msg(1, "user"), msg(7, "admin"), msg(3, "user")]),
		).toBe(7);
	});
});

describe("badgeLabel", () => {
	it("shows the count, capped at 9+", () => {
		expect(badgeLabel(1)).toBe("1");
		expect(badgeLabel(9)).toBe("9");
		expect(badgeLabel(10)).toBe("9+");
		expect(badgeLabel(240)).toBe("9+");
	});
});

describe("launcherLabel", () => {
	it("carries the count into the accessible name, singular and plural", () => {
		expect(launcherLabel(false, 0)).toBe("Open chat");
		expect(launcherLabel(false, 1)).toBe("Open chat, 1 new message");
		expect(launcherLabel(false, 4)).toBe("Open chat, 4 new messages");
		// Open panel = the thread is the read surface; the count is moot.
		expect(launcherLabel(true, 4)).toBe("Close chat");
	});
});

describe("shouldPollInBackground", () => {
	it("polls ONLY for an existing, escalated, unresolved conversation", () => {
		// No conversation in this tab (a fresh pageview) → zero background requests.
		expect(shouldPollInBackground(null)).toBe(false);
		// Chatted with the bot but never escalated → nobody owes them a reply.
		expect(shouldPollInBackground(snapshot({ escalated: false }))).toBe(false);
		// Escalated → a human is going to reply out of band. Poll.
		expect(shouldPollInBackground(snapshot({ escalated: true }))).toBe(true);
		// Resolved → terminal, nothing more is coming.
		expect(
			shouldPollInBackground(snapshot({ escalated: true, resolved: true })),
		).toBe(false);
	});
});

describe("snapshot storage", () => {
	it("round-trips through sessionStorage", () => {
		const s = snapshot({ escalated: true, lastSeenSequence: 4 });
		writeSnapshot("pk", s);
		expect(readSnapshot("pk", "c1")).toEqual(s);
	});

	it("is invisible to a rotated client id — a new conversation inherits nothing", () => {
		writeSnapshot("pk", snapshot({ escalated: true, lastSeenSequence: 4 }));
		// "Start a new conversation" mints a fresh client id.
		expect(readSnapshot("pk", "c2")).toBeNull();
		// …and therefore doesn't poll on the old conversation's behalf.
		expect(shouldPollInBackground(readSnapshot("pk", "c2"))).toBe(false);
	});

	it("is scoped per project — two widgets on one origin can't adopt each other's read state", () => {
		// The clientId is shared (one global key), so only the project scoping keeps
		// project B from inheriting project A's conversation id and escalated flag —
		// and polling on behalf of a conversation that isn't its own.
		writeSnapshot(
			"project-a",
			snapshot({ conversationId: "convA", escalated: true }),
		);
		expect(readSnapshot("project-b", "c1")).toBeNull();
		expect(readSnapshot("project-a", "c1")?.conversationId).toBe("convA");
	});

	it("clears — the conversation it described is gone", () => {
		writeSnapshot("pk", snapshot({ escalated: true }));
		clearSnapshot("pk");
		expect(readSnapshot("pk", "c1")).toBeNull();
		expect(shouldPollInBackground(readSnapshot("pk", "c1"))).toBe(false);
	});

	it("returns null for missing, malformed, or half-written records", () => {
		expect(readSnapshot("pk", "c1")).toBeNull();
		sessionStorage.setItem("llmchat_unread_pk", "{not json");
		expect(readSnapshot("pk", "c1")).toBeNull();
		// A record with no conversationId doesn't prove a conversation exists.
		sessionStorage.setItem(
			"llmchat_unread_pk",
			JSON.stringify({ clientId: "c1", escalated: true }),
		);
		expect(readSnapshot("pk", "c1")).toBeNull();
	});

	it("coerces a junk marker to 0 rather than trusting it", () => {
		sessionStorage.setItem(
			"llmchat_unread_pk",
			JSON.stringify({
				clientId: "c1",
				conversationId: "conv1",
				lastSeenSequence: "many",
			}),
		);
		expect(readSnapshot("pk", "c1")?.lastSeenSequence).toBe(0);
	});

	it("never throws when storage is blocked (partitioned third-party embed)", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		expect(readSnapshot("pk", "c1")).toBeNull();
		expect(() => writeSnapshot("pk", snapshot())).not.toThrow();
		expect(() => clearSnapshot("pk")).not.toThrow();
	});
});

describe("BACKGROUND_POLL_INTERVAL_MS", () => {
	it("stays inside the spec band — the budget is load-bearing, not just a comment", () => {
		// 20–30s per the design (see the constant's header): ≤5% of the 4000/h
		// shared /v1/messages cap per closed tab. The lifecycle tests advance
		// timers BY this constant, so without this pin a regression to any value
		// (say 1s = 3600 req/h, most of the cap from one idle tab) stays green.
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(20_000);
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeLessThanOrEqual(30_000);
		// And it must stay an order of magnitude coarser than the open panel.
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(
			POLL_INTERVAL_MS * 8,
		);
	});
});

describe("badge chrome", () => {
	it("the stylesheet styles the exact class WidgetFrame renders", () => {
		// jsdom never applies the shadow stylesheet, so nothing else binds the
		// component's className to its CSS — a typo on either side would ship an
		// unstyled raw count floating next to the launcher icon.
		expect(widgetStyles).toContain(".llmchat-bubble-badge");
		// RTL hosts: direction inherits across the shadow boundary; without this
		// pin the "9+" label bidi-reorders to "+9".
		expect(widgetStyles).toMatch(
			/\.llmchat-bubble-badge\s*\{[^}]*direction:\s*ltr/,
		);
	});
});

describe("sameSnapshot", () => {
	it("is true only when every field matches", () => {
		expect(sameSnapshot(snapshot(), snapshot())).toBe(true);
		expect(sameSnapshot(snapshot(), snapshot({ lastSeenSequence: 1 }))).toBe(
			false,
		);
		expect(sameSnapshot(snapshot(), snapshot({ resolved: true }))).toBe(false);
	});
});
