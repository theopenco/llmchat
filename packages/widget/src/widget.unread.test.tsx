import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep the live widget off the model — stub the chat transport/hook and the branding
// probe. The message FEED is deliberately NOT stubbed: this file is about WHICH
// requests the widget makes and WHEN, so it drives the real useServerMessages against
// a fetch mock and counts the calls.
//
// The stubbed useChat keeps a REAL status state, so a test can drive the
// submitted → streaming → ready transition that fires the widget's post-send refresh
// (the one poll that reaches the server while the panel is already closed).
const chat = vi.hoisted(() => ({
	setStatus: null as ((status: string) => void) | null,
}));

vi.mock("ai", () => ({ DefaultChatTransport: class {} }));
vi.mock("@ai-sdk/react", async () => {
	const { useState } = await import("react");
	return {
		Chat: class {},
		useChat: () => {
			const [status, setStatus] = useState("ready");
			chat.setStatus = setStatus;
			return {
				messages: [],
				sendMessage: vi.fn(async () => {}),
				status,
				error: null,
			};
		},
	};
});
vi.mock("./widget-config", () => ({
	useWidgetConfig: () => ({
		showBranding: false,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
	}),
}));

import { BACKGROUND_POLL_INTERVAL_MS } from "./unread";
import { POLL_INTERVAL_MS } from "./useServerMessages";
import { POST_STREAM_REFRESH_RETRY_MS, Widget } from "./widget";

interface Row {
	sequence: number;
	role: string;
	content: string;
}

/** The conversation the tab has been chatting in: visitor turn, bot turn, escalation. */
const BASE_ROWS: Row[] = [
	{ sequence: 1, role: "user", content: "my order never arrived" },
	{ sequence: 2, role: "assistant", content: "let me check that for you" },
	{
		sequence: 3,
		role: "system",
		content: "Visitor requested a human operator",
	},
];

const SNAPSHOT_KEY = "llmchat_unread_pk";

/**
 * The server's view. Keyed by client id, because that is exactly what the widget can
 * get wrong: after "start a new conversation" the id rotates, and the server knows
 * nothing about the new one — so a stale feed must not be mistaken for its feed.
 */
let conversations: Record<
	string,
	{ rows: Row[]; escalatedAt: string | null; archivedAt: string | null }
>;
let fetchMock: ReturnType<typeof vi.fn>;

function pollsFor(clientId?: string): string[] {
	return fetchMock.mock.calls
		.map((c) => String(c[0]))
		.filter(
			(u) =>
				u.includes("/v1/messages") &&
				(clientId === undefined || u.includes(`clientId=${clientId}`)),
		);
}

/**
 * Seed the tab as if the visitor had already chatted here: a client id (as
 * getOrCreateClientId would have minted) plus the read state the widget records while
 * the panel is open. Re-mounting on top of this IS the reload case.
 */
function seedTab(over: Record<string, unknown> = {}) {
	sessionStorage.setItem("llmchat_client_id", "c1");
	sessionStorage.setItem(
		SNAPSHOT_KEY,
		JSON.stringify({
			clientId: "c1",
			conversationId: "conv1",
			escalated: true,
			resolved: false,
			// The visitor last saw the thread through the escalation marker.
			lastSeenSequence: 3,
			...over,
		}),
	);
}

function storedSnapshot(): Record<string, unknown> | null {
	const raw = sessionStorage.getItem(SNAPSHOT_KEY);
	return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

/** Mount the real bubble-layout widget (launcher visible, panel closed). */
function mount() {
	return render(
		<Widget
			widgetMode="live"
			projectKey="pk"
			apiUrl="http://x"
			brandColor="#4f46e5"
		/>,
	);
}

/**
 * What the launcher's polite live region currently announces. Queried by class, not
 * by role: the escalation notice inside the panel is a role="status" too.
 */
function announcement(container: HTMLElement): string {
	return container.querySelector(".llmchat-sr-only")?.textContent ?? "";
}

/**
 * The floating launcher itself. By class, not by name: once the panel is open the
 * header carries its own "Close chat" button, so the accessible name is ambiguous.
 */
function toggleLauncher(container: HTMLElement) {
	fireEvent.click(container.querySelector("button.llmchat-bubble")!);
}

/** Let effects, the poll, and its state update settle. */
async function settle(ms = 0) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
	vi.useFakeTimers();
	conversations = {
		c1: {
			rows: BASE_ROWS,
			escalatedAt: "2026-07-13T10:00:00.000Z",
			archivedAt: null,
		},
	};
	fetchMock = vi.fn(async (url: string) => {
		const clientId = new URL(String(url)).searchParams.get("clientId") ?? "";
		const conv = conversations[clientId];
		return new Response(
			JSON.stringify(
				conv
					? {
							conversationId: `conv-${clientId}`,
							csatRating: null,
							escalatedAt: conv.escalatedAt,
							archivedAt: conv.archivedAt,
							messages: conv.rows.map((r) => ({
								id: `m${r.sequence}`,
								role: r.role,
								content: r.content,
								sequence: r.sequence,
								createdAt: r.sequence,
								rating: null,
							})),
						}
					: // What the API really answers for a visitor with no conversation:
						// 200 with a null conversation, not a 404.
						{
							conversationId: null,
							csatRating: null,
							escalatedAt: null,
							archivedAt: null,
							messages: [],
						},
			),
		);
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("unread badge — the operator replies while the panel is closed", () => {
	it("badges the launcher when a human reply lands", async () => {
		seedTab();
		const { container } = mount();
		await settle();
		// Nothing new yet — the visitor has seen everything through the escalation.
		expect(
			screen.getByRole("button", { name: "Open chat" }),
		).toBeInTheDocument();

		// The operator replies from the dashboard inbox.
		conversations.c1!.rows = [
			...BASE_ROWS,
			{ sequence: 4, role: "admin", content: "Hi — Luca here, looking now" },
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);

		expect(screen.getByText("1")).toBeInTheDocument();
		// …and it renders as the styled pill, not as loose text: this is the only
		// place that binds the component's className to the stylesheet's selector
		// (jsdom never applies the shadow CSS, so getByText alone can't).
		expect(
			container.querySelector("button.llmchat-bubble .llmchat-bubble-badge")
				?.textContent,
		).toBe("1");
		// The count reaches a screen reader too, not just the eye.
		expect(
			screen.getByRole("button", { name: "Open chat, 1 new message" }),
		).toBeInTheDocument();
		expect(announcement(container)).toBe("1 new message in the support chat");
	});

	it("counts several replies and caps the display at 9+ (the true count stays in the label)", async () => {
		seedTab();
		mount();
		await settle();
		conversations.c1!.rows = [
			...BASE_ROWS,
			...Array.from({ length: 12 }, (_, i) => ({
				sequence: 4 + i,
				role: "admin",
				content: `reply ${i}`,
			})),
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);

		expect(screen.getByText("9+")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Open chat, 12 new messages" }),
		).toBeInTheDocument();
	});

	it("clears the badge on open and remembers the thread as read", async () => {
		seedTab();
		const { container } = mount();
		await settle();
		conversations.c1!.rows = [
			...BASE_ROWS,
			{ sequence: 4, role: "admin", content: "Hi — Luca here, looking now" },
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		expect(screen.getByText("1")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /open chat/i }));
		await settle();

		expect(screen.queryByText("1")).not.toBeInTheDocument();
		// Gone from the accessible name and the live region too, not just the pixels.
		expect(
			screen.queryByRole("button", { name: /new message/i }),
		).not.toBeInTheDocument();
		expect(announcement(container)).toBe("");
		// The reply is on screen, and the marker has moved to the head of the thread —
		// so closing the panel again doesn't re-badge what was just read.
		expect(screen.getByText(/Luca here/)).toBeInTheDocument();
		expect(storedSnapshot()?.lastSeenSequence).toBe(4);
	});

	it("stores the read MARKER, never a count — a reload recomputes it from the feed", async () => {
		seedTab();
		mount();
		await settle();
		conversations.c1!.rows = [
			...BASE_ROWS,
			{ sequence: 4, role: "admin", content: "Hi — Luca here" },
			{ sequence: 5, role: "admin", content: "…and it's on its way" },
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		// Two unread replies, recomputed from a feed the stored record knows nothing
		// about — the record still holds only where the visitor got to.
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(storedSnapshot()).toEqual({
			clientId: "c1",
			conversationId: "conv-c1",
			escalated: true,
			resolved: false,
			lastSeenSequence: 3,
		});
	});

	it("never badges the visitor's own message (including a reply that arrives by email)", async () => {
		seedTab();
		mount();
		await settle();
		conversations.c1!.rows = [
			...BASE_ROWS,
			{ sequence: 4, role: "user", content: "any update? (sent by email)" },
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);

		expect(
			screen.getByRole("button", { name: "Open chat" }),
		).toBeInTheDocument();
	});

	it("badges the BOT's reply when it lands after the visitor closed the panel mid-answer", async () => {
		// The race that has no stored marker to lean on: a first-time visitor asks a
		// question and shuts the panel before the first poll has even told the widget a
		// conversation exists. The answer is persisted while they're away — and the
		// post-send refresh is what brings it back. Marking it read here (by adopting
		// the head of the feed) would lose the only message there was to badge.
		sessionStorage.setItem("llmchat_client_id", "c1");
		// No conversation exists yet — /v1/messages answers conversationId: null, so the
		// widget has nothing to record a marker against.
		delete conversations.c1;
		const { container } = mount();
		await settle();

		toggleLauncher(container);
		await settle();
		await act(async () => {
			chat.setStatus?.("streaming");
		});
		// Closed while the answer is still streaming — before any poll saw a conversation.
		toggleLauncher(container);
		await settle();
		expect(storedSnapshot()).toBeNull();

		// The exchange is now persisted; the stream settles and the widget refreshes —
		// the one poll that reaches the server with the panel already shut.
		conversations.c1 = {
			rows: [
				{ sequence: 1, role: "user", content: "do you ship to France?" },
				{ sequence: 2, role: "assistant", content: "Yes — 3-5 working days." },
			],
			escalatedAt: null,
			archivedAt: null,
		};
		await act(async () => {
			chat.setStatus?.("ready");
		});
		await settle();

		expect(
			screen.getByRole("button", { name: "Open chat, 1 new message" }),
		).toBeInTheDocument();
		expect(storedSnapshot()?.lastSeenSequence).toBe(0);
	});

	it("still badges the bot's reply when persistence loses the race with the post-send refresh", async () => {
		// Same close-mid-answer scenario, worst-case ordering: the api commits the
		// assistant row in a waitUntil AFTER the stream closes, so the immediate
		// post-send refresh can be served while the visitor's conversation doesn't
		// exist yet. With the panel closed and nothing escalated there is no poll
		// left — the one delayed retry is the only request that can still see the
		// row, and without it the badge is lost for the life of the tab.
		sessionStorage.setItem("llmchat_client_id", "c1");
		delete conversations.c1;
		const { container } = mount();
		await settle();

		toggleLauncher(container);
		await settle();
		await act(async () => {
			chat.setStatus?.("streaming");
		});
		toggleLauncher(container);
		await settle();

		// The stream settles while the row is still uncommitted: the immediate
		// refresh answers "no conversation" and no badge appears.
		await act(async () => {
			chat.setStatus?.("ready");
		});
		await settle();
		expect(
			screen.queryByRole("button", { name: /new message/i }),
		).not.toBeInTheDocument();

		// The waitUntil INSERT lands a beat later — before the delayed retry fires.
		conversations.c1 = {
			rows: [
				{ sequence: 1, role: "user", content: "do you ship to France?" },
				{ sequence: 2, role: "assistant", content: "Yes — 3-5 working days." },
			],
			escalatedAt: null,
			archivedAt: null,
		};
		await settle(POST_STREAM_REFRESH_RETRY_MS);

		expect(
			screen.getByRole("button", { name: "Open chat, 1 new message" }),
		).toBeInTheDocument();
		expect(storedSnapshot()?.lastSeenSequence).toBe(0);
	});
});

describe("unread badge — poll lifecycle", () => {
	it("a fresh pageview that never chatted makes ZERO background requests", async () => {
		// No seeded tab: the client id gets minted on mount, but no conversation exists.
		mount();
		await settle();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);

		expect(pollsFor()).toHaveLength(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("a conversation that was never escalated is not worth a background request", async () => {
		// The visitor chatted with the bot and closed the panel. Nobody owes them a
		// reply out of band, so the widget goes quiet.
		seedTab({ escalated: false });
		mount();
		await settle();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);

		expect(pollsFor()).toHaveLength(0);
	});

	it("polls on the background cadence — not the foreground one — while closed and escalated", async () => {
		seedTab();
		mount();
		await settle();
		expect(pollsFor()).toHaveLength(1); // immediately, on mount

		// The 2.5s foreground cadence must NOT be in play: an idle closed launcher
		// would otherwise burn 1440 requests/hour of the project's shared cap.
		await settle(BACKGROUND_POLL_INTERVAL_MS - 1);
		expect(pollsFor()).toHaveLength(1);

		await settle(1);
		expect(pollsFor()).toHaveLength(2);
	});

	it("stops polling for good once the conversation is resolved — but keeps the badge", async () => {
		seedTab();
		mount();
		await settle();

		// The operator answers, then closes the conversation in the inbox.
		conversations.c1!.rows = [
			...BASE_ROWS,
			{ sequence: 4, role: "admin", content: "Refund is on its way — Luca" },
		];
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		expect(screen.getByText("1")).toBeInTheDocument();

		conversations.c1!.archivedAt = "2026-07-13T10:30:00.000Z";
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		const callsAtResolve = pollsFor().length;

		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);
		expect(pollsFor()).toHaveLength(callsAtResolve);
		expect(storedSnapshot()?.resolved).toBe(true);
		// Stopping the poll must not swallow the reply the visitor still hasn't read.
		expect(screen.getByText("1")).toBeInTheDocument();
	});

	it("stops polling when the conversation is deleted from the inbox", async () => {
		// An operator hard-deletes the conversation. /v1/messages then answers 200 with
		// conversationId: null — there is nothing left to badge and nobody left to wait
		// for, so a widget that kept its escalated record would poll a dead thread for
		// the life of the tab.
		seedTab();
		mount();
		await settle();
		expect(pollsFor()).toHaveLength(1);

		delete conversations.c1;
		await settle(BACKGROUND_POLL_INTERVAL_MS);
		const callsAtDelete = pollsFor().length;

		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);
		expect(pollsFor()).toHaveLength(callsAtDelete);
		expect(storedSnapshot()).toBeNull();
	});

	it("starting a new conversation does not inherit the old one's poll", async () => {
		// "Start a new conversation" rotates the client id. The feed in hand still
		// describes the conversation being left behind for one render — adopting it
		// would staple the NEW id to the OLD conversation and poll forever, on every
		// pageview, for a thread the server has never heard of.
		seedTab();
		const { container } = mount();
		await settle();
		toggleLauncher(container);
		await settle();

		fireEvent.click(
			screen.getByRole("button", { name: /start a new conversation/i }),
		);
		await settle();
		// Ending a conversation is the CSAT moment; skipping it completes the reset.
		fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
		await settle();

		const rotated = sessionStorage.getItem("llmchat_client_id");
		expect(rotated).not.toBe("c1");
		// The record must never name the old conversation under the new id.
		expect(storedSnapshot()?.clientId).not.toBe(rotated);

		// Close the fresh (empty, unescalated) conversation: nothing to wait for.
		toggleLauncher(container);
		await settle();
		const before = pollsFor(rotated!).length;
		await settle(BACKGROUND_POLL_INTERVAL_MS * 5);
		expect(pollsFor(rotated!)).toHaveLength(before);
		expect(screen.queryByRole("button", { name: /new message/i })).toBeNull();
	});

	it("clicking escalate does not leak onto the NEXT conversation after the operator deletes this one", async () => {
		// escalatedLocal is a session flag, not server state. If the operator
		// deletes the escalated conversation and the visitor keeps chatting under
		// the same client id, the successor must not inherit "escalated" — that
		// would arm the background poll for a conversation no human owes a reply
		// on, at 144 req/h for the life of the tab.
		sessionStorage.setItem("llmchat_client_id", "c1");
		conversations.c1 = {
			rows: [
				{ sequence: 1, role: "user", content: "can I talk to a human?" },
				{ sequence: 2, role: "assistant", content: "Let me get someone." },
			],
			escalatedAt: null,
			archivedAt: null,
		};
		const { container } = mount();
		await settle();
		toggleLauncher(container);
		await settle();

		// The explicit ask reveals the CTA; clicking it sets the session flag.
		fireEvent.click(screen.getByRole("button", { name: /talk to a human/i }));
		await settle();
		expect(storedSnapshot()?.escalated).toBe(true);

		// Operator hard-deletes the conversation; the next open-panel poll sees it.
		delete conversations.c1;
		await settle(POLL_INTERVAL_MS);
		expect(storedSnapshot()).toBeNull();

		// The visitor starts over in the same tab: a NEW conversation under the
		// same client id, never escalated.
		conversations.c1 = {
			rows: [{ sequence: 1, role: "user", content: "hello again" }],
			escalatedAt: null,
			archivedAt: null,
		};
		await settle(POLL_INTERVAL_MS);
		expect(storedSnapshot()?.escalated).toBe(false);

		// Closed and not escalated: the tab goes quiet.
		toggleLauncher(container);
		await settle();
		const before = pollsFor().length;
		await settle(BACKGROUND_POLL_INTERVAL_MS * 10);
		expect(pollsFor()).toHaveLength(before);
	});

	it("a pageview AFTER starting a new conversation still makes ZERO background requests", async () => {
		// The rotation bug's real cost: a cross-wired record is persisted, so it
		// re-arms the poll on every subsequent navigation of the customer's site.
		seedTab();
		const view = mount();
		await settle();
		toggleLauncher(view.container);
		await settle();
		fireEvent.click(
			screen.getByRole("button", { name: /start a new conversation/i }),
		);
		await settle();
		fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
		await settle();
		view.unmount();

		// Fresh pageview, same tab (sessionStorage survives the navigation).
		fetchMock.mockClear();
		mount();
		await settle();
		await settle(BACKGROUND_POLL_INTERVAL_MS * 5);

		expect(pollsFor()).toHaveLength(0);
	});
});
