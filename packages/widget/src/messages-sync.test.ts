import { ESCALATED_HOLDING_MESSAGE } from "@llmchat/shared/holding";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMessages, mergeMessages } from "./messages-sync";

import type { ServerMessage } from "./messages-sync";

function srv(seq: number, role: string, content: string): ServerMessage {
	return { id: `s${seq}`, role, content, sequence: seq, createdAt: seq };
}

describe("mergeMessages", () => {
	it("shows persisted messages including admin replies, in feed order", () => {
		const merged = mergeMessages(
			[
				srv(1, "user", "help"),
				srv(2, "assistant", "Sure!"),
				srv(3, "admin", "A human here — hi!"),
			],
			[],
		);
		expect(merged.map((m) => `${m.role}:${m.content}`)).toEqual([
			"user:help",
			"assistant:Sure!",
			"admin:A human here — hi!",
		]);
	});

	it("does not duplicate a local message that is already persisted", () => {
		const merged = mergeMessages(
			[srv(1, "user", "hello")],
			[{ id: "l1", role: "user", content: "hello" }],
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]!.id).toBe("s1");
	});

	it("keeps an in-flight local message the server has not stored yet", () => {
		const merged = mergeMessages(
			[srv(1, "user", "hello")],
			[
				{ id: "l1", role: "user", content: "hello" },
				{ id: "l2", role: "assistant", content: "typing par" }, // streaming
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "l2"]);
	});

	it("keeps repeated identical texts distinct (no over-deduplication)", () => {
		// Visitor legitimately sends "hi" twice; the server has both.
		const merged = mergeMessages(
			[srv(1, "user", "hi"), srv(2, "user", "hi")],
			[
				{ id: "l1", role: "user", content: "hi" },
				{ id: "l2", role: "user", content: "hi" },
			],
		);
		expect(merged).toHaveLength(2);
	});

	it("appends a second identical local send the server only stored once", () => {
		const merged = mergeMessages(
			[srv(1, "user", "hi")],
			[
				{ id: "l1", role: "user", content: "hi" },
				{ id: "l2", role: "user", content: "hi" }, // still in flight
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "l2"]);
	});

	it("does not match a local user message against an admin message with the same text", () => {
		const merged = mergeMessages(
			[srv(1, "admin", "ok")],
			[{ id: "l1", role: "user", content: "ok" }],
		);
		expect(merged).toHaveLength(2);
	});

	it("orders admin replies before the visitor's newer unsent message", () => {
		const merged = mergeMessages(
			[srv(1, "user", "help"), srv(2, "admin", "On it!")],
			[
				{ id: "l1", role: "user", content: "help" },
				{ id: "l2", role: "user", content: "thanks" }, // not yet persisted
			],
		);
		expect(merged.map((m) => m.content)).toEqual(["help", "On it!", "thanks"]);
	});
});

describe("mergeMessages — holding-ack anchoring (Bug 3 / Problem 1)", () => {
	const HOLD = {
		id: "lh",
		role: "assistant",
		content: ESCALATED_HOLDING_MESSAGE,
	};

	it("anchors the holding ack right after the visitor turn it acknowledges — ABOVE a later admin reply, not floating at the bottom", () => {
		const merged = mergeMessages(
			[srv(1, "user", "help me"), srv(2, "admin", "human here")],
			[{ id: "l1", role: "user", content: "help me" }, HOLD],
		);
		expect(merged.map((m) => `${m.role}:${m.content}`)).toEqual([
			"user:help me",
			`assistant:${ESCALATED_HOLDING_MESSAGE}`,
			"admin:human here",
		]);
		// The contradiction we're fixing: the ack must NOT be the last row when a
		// human has replied below it.
		expect(merged[merged.length - 1]!.role).toBe("admin");
	});

	it("keeps the holding ack anchored when a LATER visitor turn is persisted (no float to the bottom)", () => {
		const merged = mergeMessages(
			[srv(1, "user", "first"), srv(2, "user", "second")],
			[
				{ id: "l1", role: "user", content: "first" },
				HOLD,
				{ id: "l2", role: "user", content: "second" },
			],
		);
		expect(merged.map((m) => m.content)).toEqual([
			"first",
			ESCALATED_HOLDING_MESSAGE,
			"second",
		]);
	});

	it("anchors N holding acks, each after its OWN triggering visitor turn", () => {
		const merged = mergeMessages(
			[srv(1, "user", "q1"), srv(2, "user", "q2")],
			[
				{ id: "l1", role: "user", content: "q1" },
				{ id: "h1", role: "assistant", content: ESCALATED_HOLDING_MESSAGE },
				{ id: "l2", role: "user", content: "q2" },
				{ id: "h2", role: "assistant", content: ESCALATED_HOLDING_MESSAGE },
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "h1", "s2", "h2"]);
	});

	it("does NOT anchor the normal in-flight pair — a streaming (non-holding) assistant reply still tails", () => {
		const merged = mergeMessages(
			[srv(1, "user", "hello")],
			[
				{ id: "l1", role: "user", content: "hello" },
				{ id: "l2", role: "assistant", content: "streaming answer…" },
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "l2"]);
	});

	it("tails a holding with no preceding persisted message yet (transient, pre-poll)", () => {
		const merged = mergeMessages(
			[], // nothing persisted yet
			[{ id: "l1", role: "user", content: "q1" }, HOLD],
		);
		expect(merged.map((m) => m.id)).toEqual(["l1", "lh"]);
	});

	it("the anchored holding ack is never rateable", () => {
		const merged = mergeMessages(
			[srv(1, "user", "help me")],
			[{ id: "l1", role: "user", content: "help me" }, HOLD],
		);
		const ack = merged.find((m) => m.content === ESCALATED_HOLDING_MESSAGE);
		expect(ack?.rateable).toBeFalsy();
	});
});

describe("fetchMessages", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("encodes query params so a hostile clientId cannot smuggle params", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ messages: [] })));
		vi.stubGlobal("fetch", fetchMock);

		await fetchMessages("http://x", "pk", "a&projectKey=evil");

		const url = fetchMock.mock.calls[0]![0] as string;
		expect(url).toContain("clientId=a%26projectKey%3Devil");
	});

	it("throws on a non-2xx response instead of treating it as an empty feed", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response("nope", { status: 429 })),
		);
		await expect(fetchMessages("http://x", "pk", "c1")).rejects.toThrow(/429/);
	});

	it("carries escalatedAt through (lets the widget hydrate the handoff state)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						escalatedAt: "2026-06-29T00:00:00.000Z",
						messages: [],
					}),
				),
			),
		);
		const feed = await fetchMessages("http://x", "pk", "c1");
		expect(feed.escalatedAt).toBe("2026-06-29T00:00:00.000Z");
	});

	it("defaults escalatedAt to null when the server omits it (staged-rollout safe)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [] }))),
		);
		expect(
			(await fetchMessages("http://x", "pk", "c1")).escalatedAt,
		).toBeNull();
	});
});
