/**
 * Unread badge — the port of the script-tag widget's #144 behavior. Two layers:
 *
 *   - UI: the real `ClankerSupportWidget` (launcher + badge + live region),
 *   - lifecycle: the real provider driven through a context probe, counting
 *     actual /v1/messages requests against fake timers.
 *
 * The feed is deliberately NOT stubbed at the provider level — these tests
 * drive the real poll effects and count network calls, because the lifecycle
 * rules (zero requests on a fresh pageview, background cadence, stop on
 * resolve/deletion) ARE the feature.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { widgetStyles } from "./styles";
import { ClankerSupportWidget } from "./widget";
import { useClankerSupport } from "../client/context";
import { ClankerSupportProvider } from "../client/provider";
import {
	BACKGROUND_POLL_INTERVAL_MS,
	POST_STREAM_REFRESH_RETRY_MS,
} from "../protocol/unread";

import type { ClankerSupportContextValue } from "../client/context";
import type { ServerMessage } from "../protocol/api";
import type { WidgetConfig } from "../types";

const API = "https://api.test";
const CONFIG: WidgetConfig = { showBranding: true, privacyPolicyUrl: null };
/** Foreground cadence in client/provider.tsx. */
const FOREGROUND_POLL_INTERVAL_MS = 2_500;
const SNAPSHOT_KEY = "llmchat_unread_pk_test";

// The server's view, keyed by client id — a missing entry answers what the
// real api answers for a no-conversation visitor: 200 with a null
// conversationId, NOT a 404.
interface Conversation {
	rows: ServerMessage[];
	escalatedAt: number | null;
	archivedAt: number | null;
}
let conversations: Record<string, Conversation>;

const SSE_START =
	`data: ${JSON.stringify({ type: "text-start", id: "t1" })}\n\n` +
	`data: ${JSON.stringify({ type: "text-delta", id: "t1", delta: "sure." })}\n\n`;
const SSE_END = "data: [DONE]\n\n";

// When true, /v1/chat streams its deltas but withholds [DONE] until the test
// calls releaseChatStream() — the only way to interleave real work (closing
// the panel, the server committing rows) MID-answer, since everything else in
// this mock resolves on microtasks.
let holdChatStream: boolean;
let releaseChatStream: (() => void) | null;

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
	const url = String(input);
	if (url.includes("/v1/messages")) {
		const cid = new URL(url).searchParams.get("clientId") ?? "";
		const conv = conversations[cid];
		if (!conv) {
			return Response.json({
				conversationId: null,
				csatRating: null,
				escalatedAt: null,
				archivedAt: null,
				messages: [],
			});
		}
		return Response.json({
			conversationId: "conv1",
			csatRating: null,
			escalatedAt: conv.escalatedAt,
			archivedAt: conv.archivedAt,
			messages: conv.rows,
		});
	}
	if (url.includes("/v1/chat")) {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(SSE_START));
				if (holdChatStream) {
					releaseChatStream = () => {
						releaseChatStream = null;
						controller.enqueue(encoder.encode(SSE_END));
						controller.close();
					};
				} else {
					controller.enqueue(encoder.encode(SSE_END));
					controller.close();
				}
			},
		});
		return new Response(stream, {
			headers: { "content-type": "text/event-stream" },
		});
	}
	if (url.includes("/v1/escalate")) {
		return Response.json({ summary: null });
	}
	if (url.includes("/v1/resolve")) {
		return Response.json({ resolved: true });
	}
	return Response.json({ ok: true });
});

function pollsFor(): number {
	return fetchMock.mock.calls.filter((c) =>
		String(c[0]).includes("/v1/messages"),
	).length;
}

function row(
	partial: Partial<ServerMessage> & { id: string; sequence: number },
): ServerMessage {
	return { role: "assistant", content: "hello", ...partial };
}

/** Plant a tab that already chatted: clientId + an escalated read snapshot
 * (marker 3), overridable per-field — re-mounting on top of this IS the
 * reload case. */
function seedTab(snapshot: Record<string, unknown> = {}) {
	sessionStorage.setItem("llmchat_client_id", "c1");
	sessionStorage.setItem(
		SNAPSHOT_KEY,
		JSON.stringify({
			clientId: "c1",
			conversationId: "conv1",
			escalated: true,
			resolved: false,
			lastSeenSequence: 3,
			...snapshot,
		}),
	);
}

function storedSnapshot(): { lastSeenSequence: number } | null {
	const raw = sessionStorage.getItem(SNAPSHOT_KEY);
	return raw ? (JSON.parse(raw) as { lastSeenSequence: number }) : null;
}

/** Flush effects, in-flight polls and their state updates, advancing `ms`. */
async function settle(ms = 0) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

let ctx: ClankerSupportContextValue;
function Probe() {
	ctx = useClankerSupport();
	return null;
}

function renderWidget() {
	return render(
		<ClankerSupportWidget
			apiKey="pk_test"
			apiUrl={API}
			initialConfig={CONFIG}
		/>,
	);
}

function renderProbe() {
	return render(
		<ClankerSupportProvider
			apiKey="pk_test"
			apiUrl={API}
			initialConfig={CONFIG}
		>
			<Probe />
		</ClankerSupportProvider>,
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	conversations = {};
	holdChatStream = false;
	releaseChatStream = null;
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("unread badge — the operator replies while the panel is closed", () => {
	it("badges the launcher when a human reply lands", async () => {
		seedTab();
		conversations.c1 = {
			rows: [
				row({ id: "m1", role: "user", content: "help", sequence: 1 }),
				row({ id: "m2", role: "assistant", content: "sure", sequence: 2 }),
				row({ id: "m3", role: "system", content: "escalated", sequence: 3 }),
			],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle();
		// Everything up to the marker (3) is read — no badge yet.
		expect(container.querySelector(".clanker-badge")).toBeNull();

		conversations.c1.rows.push(
			row({ id: "m4", role: "admin", content: "operator here", sequence: 4 }),
		);
		await settle(BACKGROUND_POLL_INTERVAL_MS);

		expect(container.querySelector(".clanker-badge")?.textContent).toBe("1");
		expect(
			screen.getByRole("button", { name: "Open chat, 1 new message" }),
		).toBeInTheDocument();
		expect(container.querySelector(".clanker-sr-only")?.textContent).toBe(
			"1 new message in the support chat",
		);
	});

	it("counts several replies and caps the display at 9+ (the true count stays in the label)", async () => {
		seedTab();
		conversations.c1 = {
			rows: Array.from({ length: 15 }, (_, i) =>
				row({
					id: `m${i + 1}`,
					role: "admin",
					content: `reply ${i + 1}`,
					sequence: i + 1,
				}),
			),
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle();

		// Marker is 3 → 12 unread. Display caps, the accessible name doesn't.
		expect(container.querySelector(".clanker-badge")?.textContent).toBe("9+");
		expect(
			screen.getByRole("button", { name: "Open chat, 12 new messages" }),
		).toBeInTheDocument();
	});

	it("clears the badge on open and remembers the thread as read", async () => {
		seedTab();
		conversations.c1 = {
			rows: [
				row({ id: "m1", role: "user", content: "help", sequence: 1 }),
				row({ id: "m2", role: "admin", content: "operator here", sequence: 4 }),
			],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle();
		expect(container.querySelector(".clanker-badge")?.textContent).toBe("1");

		fireEvent.click(container.querySelector(".clanker-launcher")!);
		await settle();
		expect(container.querySelector(".clanker-badge")).toBeNull();
		// The stored MARKER rode to the head while open.
		expect(storedSnapshot()?.lastSeenSequence).toBe(4);

		fireEvent.click(container.querySelector(".clanker-launcher")!);
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		// Nothing new since — the badge stays cleared across close + a poll.
		expect(container.querySelector(".clanker-badge")).toBeNull();
	});

	it("stores the read MARKER, never a count — a reload recomputes it from the feed", async () => {
		// The snapshot says "seen through 3"; the feed has moved to 6 with two
		// countable rows. A fresh mount (the reload) must badge 2 from the feed —
		// no stored count exists to resurrect.
		seedTab({ lastSeenSequence: 3 });
		conversations.c1 = {
			rows: [
				row({ id: "m4", role: "user", content: "me again", sequence: 4 }),
				row({ id: "m5", role: "admin", content: "hi", sequence: 5 }),
				row({ id: "m6", role: "assistant", content: "also", sequence: 6 }),
			],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle();
		expect(container.querySelector(".clanker-badge")?.textContent).toBe("2");
	});

	it("never badges the visitor's own message (including a reply that arrives by email)", async () => {
		seedTab();
		conversations.c1 = {
			rows: [
				row({ id: "m4", role: "user", content: "emailed reply", sequence: 4 }),
				row({ id: "m5", role: "user", content: "another", sequence: 5 }),
			],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		expect(container.querySelector(".clanker-badge")).toBeNull();
	});
});

describe("unread badge — poll lifecycle", () => {
	it("a fresh pageview that never chatted makes ZERO background requests", async () => {
		renderProbe();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);
		expect(pollsFor()).toBe(0);
		// Literally zero network calls of any kind — the server-prefetched
		// config means an idle pageview costs nothing.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("a conversation that was never escalated is not worth a background request", async () => {
		seedTab({ escalated: false });
		conversations.c1 = {
			rows: [row({ id: "m1", role: "assistant", content: "hi", sequence: 1 })],
			escalatedAt: null,
			archivedAt: null,
		};
		renderProbe();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);
		expect(pollsFor()).toBe(0);
	});

	it("polls on the background cadence — not the foreground one — while closed and escalated", async () => {
		seedTab();
		conversations.c1 = {
			rows: [row({ id: "m1", role: "system", content: "esc", sequence: 1 })],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		renderProbe();
		await settle();
		expect(pollsFor()).toBe(1); // the immediate load

		await settle(FOREGROUND_POLL_INTERVAL_MS * 3);
		expect(pollsFor()).toBe(1); // no foreground-cadence leak while closed

		await settle(
			BACKGROUND_POLL_INTERVAL_MS - FOREGROUND_POLL_INTERVAL_MS * 3 - 1,
		);
		expect(pollsFor()).toBe(1);
		await settle(1);
		expect(pollsFor()).toBe(2); // exactly on the boundary
	});

	it("stops polling for good once the conversation is resolved — but keeps the badge", async () => {
		seedTab({ lastSeenSequence: 1 });
		conversations.c1 = {
			rows: [
				row({ id: "m1", role: "system", content: "esc", sequence: 1 }),
				row({
					id: "m2",
					role: "admin",
					content: "fixed it, closing",
					sequence: 2,
				}),
			],
			escalatedAt: 1720000000,
			archivedAt: 1720000500,
		};
		renderProbe();
		await settle();
		const after = pollsFor();
		expect(after).toBeGreaterThan(0);
		// The operator's parting reply still shows — resolve silences the poll,
		// not the news.
		expect(ctx.unreadCount).toBe(1);

		await settle(BACKGROUND_POLL_INTERVAL_MS * 5);
		expect(pollsFor()).toBe(after);
	});

	it("stops polling when the conversation is deleted from the inbox — and the tab's handoff flags reset", async () => {
		seedTab();
		conversations.c1 = {
			rows: [row({ id: "m1", role: "system", content: "esc", sequence: 1 })],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		renderProbe();
		await settle();
		expect(pollsFor()).toBe(1);

		// The visitor also escalated in-session — the session-local flag is set
		// on top of the server state.
		await act(async () => {
			await ctx.escalate();
		});
		await settle();
		expect(ctx.escalated).toBe(true);

		// Operator deletes the conversation from the inbox.
		delete conversations.c1;
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		const after = pollsFor();

		// Snapshot gone → polling stops for the life of the tab...
		expect(storedSnapshot()).toBeNull();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 5);
		expect(pollsFor()).toBe(after);
		// ...and the session flags reset with it: the tab's NEXT conversation
		// (same clientId mints a fresh one) must not inherit "escalated" — that
		// would arm a background poll no human owes a reply on — nor "resolved",
		// which would silently disarm its badge.
		expect(ctx.escalated).toBe(false);
		expect(ctx.resolved).toBe(false);
	});

	it("badges the BOT's reply when it lands after the visitor closed the panel mid-answer", async () => {
		sessionStorage.setItem("llmchat_client_id", "c1");
		renderProbe();
		await settle();
		await act(async () => {
			ctx.setOpen(true);
		});
		await settle();

		// Hold the answer stream open so the close is genuinely MID-answer.
		holdChatStream = true;
		let sendDone: Promise<void>;
		await act(async () => {
			sendDone = ctx.send("hi");
		});
		await act(async () => {
			ctx.setOpen(false);
		});
		// The waitUntil INSERT wins the race this time: the rows are committed
		// before the stream ends, so the IMMEDIATE post-send refresh sees them —
		// no retry involved.
		conversations.c1 = {
			rows: [
				row({ id: "m1", role: "user", content: "hi", sequence: 1 }),
				row({ id: "m2", role: "assistant", content: "sure.", sequence: 2 }),
			],
			escalatedAt: null,
			archivedAt: null,
		};
		await act(async () => {
			releaseChatStream!();
			await sendDone!;
		});
		await settle();

		// Badge present NOW — the retry (2.5s out) hasn't fired yet.
		expect(ctx.unreadCount).toBe(1);
		// The marker persisted as 0 — nothing was seen while open.
		expect(storedSnapshot()?.lastSeenSequence).toBe(0);
	});

	it("still badges the bot's reply when persistence loses the race with the post-send refresh", async () => {
		// Pin the clientId (no conversation, no snapshot) so the mock can serve
		// this tab's rows once the "waitUntil INSERT" lands below.
		sessionStorage.setItem("llmchat_client_id", "c1");
		renderProbe();
		await settle();

		// Open, send. The api's waitUntil hasn't committed the rows yet, so the
		// immediate post-send refresh answers "no conversation".
		await act(async () => {
			ctx.setOpen(true);
		});
		await settle();
		await act(async () => {
			await ctx.send("hi");
		});
		await settle();
		expect(ctx.unreadCount).toBe(0);

		// Close mid-wait; then the waitUntil INSERT lands server-side.
		await act(async () => {
			ctx.setOpen(false);
		});
		conversations.c1 = {
			rows: [
				row({ id: "m1", role: "user", content: "hi", sequence: 1 }),
				row({ id: "m2", role: "assistant", content: "sure.", sequence: 2 }),
			],
			escalatedAt: null,
			archivedAt: null,
		};
		const before = pollsFor();
		await settle(POST_STREAM_REFRESH_RETRY_MS);

		// The one delayed retry — and only it — saw the row.
		expect(pollsFor()).toBe(before + 1);
		expect(ctx.unreadCount).toBe(1);
		// The marker persisted as 0: nothing was seen. Adopting the head here
		// would have silently marked the only badgeable message read.
		expect(storedSnapshot()?.lastSeenSequence).toBe(0);

		// A bot-only conversation never earns a background timer.
		await settle(BACKGROUND_POLL_INTERVAL_MS * 3);
		expect(pollsFor()).toBe(before + 1);
	});

	it("a pageview AFTER the deletion still makes ZERO background requests", async () => {
		seedTab();
		// No conversation server-side (deleted before this pageview) and the
		// snapshot names it — the first poll must clear it, then go quiet.
		renderProbe();
		await settle();
		expect(pollsFor()).toBe(1);
		expect(storedSnapshot()).toBeNull();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 5);
		expect(pollsFor()).toBe(1);
	});
});

describe("badge chrome", () => {
	it("renders inside the launcher button and rides the stylesheet's animation budget", async () => {
		seedTab();
		conversations.c1 = {
			rows: [row({ id: "m1", role: "admin", content: "hey", sequence: 4 })],
			escalatedAt: 1720000000,
			archivedAt: null,
		};
		const { container } = renderWidget();
		await settle();
		const badge = container.querySelector(".clanker-launcher .clanker-badge");
		expect(badge).not.toBeNull();
		expect(badge).toHaveAttribute("aria-hidden", "true");
		// Reduced-motion coverage exists for the badge animation.
		expect(widgetStyles).toMatch(
			/prefers-reduced-motion[\s\S]*\.clanker-badge\s*\{\s*animation:\s*none/,
		);
	});
});
