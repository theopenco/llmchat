import { describe, expect, it } from "vitest";

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
import { widgetStyles } from "../default/styles";

import type { ConversationSnapshot } from "./unread";
import type { ServerMessage } from "./api";

/** Foreground poll cadence in client/provider.tsx — pinned here so the budget
 * assertion below can't drift when either constant moves. */
const FOREGROUND_POLL_INTERVAL_MS = 2_500;

function msg(partial: Partial<ServerMessage> & { id: string }): ServerMessage {
	return { role: "assistant", content: "hello", ...partial };
}

const SNAPSHOT: ConversationSnapshot = {
	clientId: "c1",
	conversationId: "conv1",
	escalated: true,
	resolved: false,
	lastSeenSequence: 3,
};

describe("countUnread", () => {
	it("counts only rows past the marker that render as somebody else's message", () => {
		const feed = [
			msg({ id: "m1", role: "user", content: "hi", sequence: 1 }),
			msg({ id: "m2", role: "assistant", content: "hello!", sequence: 2 }),
			msg({ id: "m3", role: "system", content: "escalated", sequence: 3 }),
			msg({ id: "m4", role: "admin", content: "operator here", sequence: 4 }),
			msg({
				id: "m5",
				role: "assistant",
				content: "anything else?",
				sequence: 5,
			}),
		];
		// Marker at 2: system (3), admin (4) and assistant (5) all count.
		expect(countUnread(feed, 2)).toBe(3);
	});

	it("never counts the visitor's own messages — sending doesn't badge yourself", () => {
		const feed = [
			msg({ id: "m1", role: "user", content: "hi", sequence: 1 }),
			msg({ id: "m2", role: "user", content: "also this", sequence: 2 }),
		];
		expect(countUnread(feed, 0)).toBe(0);
	});

	it("ignores empty rows, which the panel doesn't render either", () => {
		const feed = [
			msg({ id: "m1", role: "assistant", content: "", sequence: 5 }),
		];
		expect(countUnread(feed, 0)).toBe(0);
	});

	it("ignores rows without a sequence — unorderable rows can't sit past a marker", () => {
		const feed = [msg({ id: "m1", role: "admin", content: "no seq" })];
		expect(countUnread(feed, 0)).toBe(0);
	});

	it("survives a marker ahead of the feed (rows deleted from the inbox)", () => {
		const feed = [msg({ id: "m1", role: "admin", content: "x", sequence: 2 })];
		expect(countUnread(feed, 10)).toBe(0);
	});

	it("is exact across the sequence gap a hidden internal note leaves (#146)", () => {
		// Internal notes hold sequences 3–4 but the api never returns them to the
		// widget — the count must be what the panel will show, not the gap width.
		const feed = [
			msg({ id: "m1", role: "user", content: "hi", sequence: 1 }),
			msg({ id: "m2", role: "assistant", content: "yo", sequence: 2 }),
			msg({ id: "m5", role: "admin", content: "real reply", sequence: 5 }),
		];
		expect(countUnread(feed, 2)).toBe(1);
	});
});

describe("latestSequence", () => {
	it("is 0 for an empty feed and the head otherwise", () => {
		expect(latestSequence([])).toBe(0);
		expect(
			latestSequence([
				msg({ id: "a", sequence: 4 }),
				msg({ id: "b", sequence: 9 }),
				msg({ id: "c" }), // no sequence — contributes nothing
				msg({ id: "d", sequence: 2 }),
			]),
		).toBe(9);
	});
});

describe("badgeLabel", () => {
	it("shows the count, capped at 9+", () => {
		expect(badgeLabel(1)).toBe("1");
		expect(badgeLabel(9)).toBe("9");
		expect(badgeLabel(10)).toBe("9+");
		expect(badgeLabel(230)).toBe("9+");
	});
});

describe("launcherLabel", () => {
	it("carries the count into the accessible name, singular and plural", () => {
		expect(launcherLabel(true, 5)).toBe("Close chat");
		expect(launcherLabel(false, 0)).toBe("Open chat");
		expect(launcherLabel(false, 1)).toBe("Open chat, 1 new message");
		expect(launcherLabel(false, 3)).toBe("Open chat, 3 new messages");
	});
});

describe("shouldPollInBackground", () => {
	it("polls ONLY for an existing, escalated, unresolved conversation", () => {
		expect(shouldPollInBackground(null)).toBe(false);
		expect(shouldPollInBackground({ ...SNAPSHOT, escalated: false })).toBe(
			false,
		);
		expect(shouldPollInBackground({ ...SNAPSHOT, resolved: true })).toBe(false);
		expect(shouldPollInBackground(SNAPSHOT)).toBe(true);
	});
});

describe("snapshot storage", () => {
	it("round-trips through sessionStorage", () => {
		writeSnapshot("pk", SNAPSHOT);
		expect(readSnapshot("pk", "c1")).toEqual(SNAPSHOT);
	});

	it("is invisible to a foreign client id — another conversation inherits nothing", () => {
		writeSnapshot("pk", SNAPSHOT);
		expect(readSnapshot("pk", "c2")).toBeNull();
	});

	it("is scoped per project — two widgets on one origin can't adopt each other's read state", () => {
		writeSnapshot("pk_a", SNAPSHOT);
		expect(readSnapshot("pk_b", "c1")).toBeNull();
	});

	it("clears — the conversation it described is gone", () => {
		writeSnapshot("pk", SNAPSHOT);
		clearSnapshot("pk");
		expect(readSnapshot("pk", "c1")).toBeNull();
	});

	it("returns null for missing, malformed, or half-written records", () => {
		expect(readSnapshot("pk", "c1")).toBeNull();
		sessionStorage.setItem("llmchat_unread_pk", "{not json");
		expect(readSnapshot("pk", "c1")).toBeNull();
		sessionStorage.setItem(
			"llmchat_unread_pk",
			JSON.stringify({ clientId: "c1" }), // no conversationId
		);
		expect(readSnapshot("pk", "c1")).toBeNull();
	});

	it("coerces a junk marker to 0 rather than trusting it", () => {
		sessionStorage.setItem(
			"llmchat_unread_pk",
			JSON.stringify({
				clientId: "c1",
				conversationId: "conv1",
				escalated: true,
				resolved: false,
				lastSeenSequence: "banana",
			}),
		);
		expect(readSnapshot("pk", "c1")?.lastSeenSequence).toBe(0);
	});

	it("uses the script-tag widget's exact key — a migrated site keeps its read state", () => {
		writeSnapshot("pk", SNAPSHOT);
		expect(sessionStorage.getItem("llmchat_unread_pk")).not.toBeNull();
	});

	it("never throws when storage is blocked (partitioned third-party embed)", () => {
		const real = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")!;
		const blocked = new Proxy(
			{},
			{
				get() {
					throw new Error("storage disabled");
				},
			},
		) as Storage;
		Object.defineProperty(globalThis, "sessionStorage", {
			value: blocked,
			configurable: true,
		});
		try {
			expect(readSnapshot("pk", "c1")).toBeNull();
			expect(() => writeSnapshot("pk", SNAPSHOT)).not.toThrow();
			expect(() => clearSnapshot("pk")).not.toThrow();
		} finally {
			Object.defineProperty(globalThis, "sessionStorage", real);
		}
	});
});

describe("sameSnapshot", () => {
	it("is true only when every field matches", () => {
		expect(sameSnapshot(SNAPSHOT, { ...SNAPSHOT })).toBe(true);
		expect(sameSnapshot(SNAPSHOT, { ...SNAPSHOT, resolved: true })).toBe(false);
		expect(sameSnapshot(SNAPSHOT, { ...SNAPSHOT, lastSeenSequence: 4 })).toBe(
			false,
		);
		expect(sameSnapshot(SNAPSHOT, { ...SNAPSHOT, clientId: "c2" })).toBe(false);
		expect(
			sameSnapshot(SNAPSHOT, { ...SNAPSHOT, conversationId: "conv2" }),
		).toBe(false);
		expect(sameSnapshot(SNAPSHOT, { ...SNAPSHOT, escalated: false })).toBe(
			false,
		);
	});
});

describe("BACKGROUND_POLL_INTERVAL_MS", () => {
	it("stays inside the spec band — the budget is load-bearing, not just a comment", () => {
		// The lifecycle tests advance timers BY this constant, so without the pin
		// a regression to e.g. 1s (3600 req/h against a 4000/h cap) would stay
		// green. 20–30s is the band the cost model in unread.ts argues for, and
		// the closed-panel poll must stay an order of magnitude coarser than the
		// open panel's.
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(20_000);
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeLessThanOrEqual(30_000);
		expect(BACKGROUND_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(
			FOREGROUND_POLL_INTERVAL_MS * 8,
		);
	});
});

describe("badge chrome", () => {
	it("the stylesheet styles the exact classes the default widget renders", () => {
		// jsdom never applies the injected stylesheet, so this string check is the
		// only class↔CSS binding: the badge rule must exist, must pin direction
		// (RTL hosts would reorder "9+" to "+9"), and the launcher must anchor it.
		expect(widgetStyles).toContain(".clanker-badge");
		expect(widgetStyles).toMatch(/\.clanker-badge\s*\{[^}]*direction:\s*ltr/);
		expect(widgetStyles).toMatch(
			/\.clanker-launcher\s*\{[^}]*position:\s*relative/,
		);
		expect(widgetStyles).toContain(".clanker-sr-only");
	});
});
