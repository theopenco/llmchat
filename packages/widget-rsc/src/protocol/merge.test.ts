import { describe, expect, it } from "vitest";

import { ESCALATED_HOLDING_MESSAGE } from "./constants";
import { mergeMessages } from "./merge";

import type { ServerMessage } from "./api";
import type { LocalMessage } from "./merge";

function server(
	id: string,
	role: string,
	content: string,
	rating: "up" | "down" | null = null,
): ServerMessage {
	return { id, role, content, rating };
}

function local(
	id: string,
	role: "user" | "assistant",
	content: string,
): LocalMessage {
	return { id, role, content };
}

describe("mergeMessages", () => {
	it("renders persisted rows and drops matched local copies", () => {
		const merged = mergeMessages(
			[server("s1", "user", "hi"), server("s2", "assistant", "hello!")],
			[local("l1", "user", "hi"), local("l2", "assistant", "hello!")],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "s2"]);
	});

	it("keeps in-flight local messages at the tail", () => {
		const merged = mergeMessages(
			[server("s1", "user", "hi"), server("s2", "assistant", "hello!")],
			[
				local("l1", "user", "hi"),
				local("l2", "assistant", "hello!"),
				local("l3", "user", "another question"),
				local("l4", "assistant", "streaming rep"),
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "s2", "l3", "l4"]);
	});

	it("includes operator (admin) replies from the feed", () => {
		const merged = mergeMessages(
			[server("s1", "user", "help"), server("s2", "admin", "on it!")],
			[local("l1", "user", "help")],
		);
		expect(merged.map((m) => m.role)).toEqual(["user", "admin"]);
	});

	it("anchors the holding ack to the visitor message it acknowledges", () => {
		// Visitor messaged an escalated conversation: the ack streamed locally
		// (never persisted) and an operator replied AFTER it. A naive tail-dump
		// would float the ack below the operator reply.
		const merged = mergeMessages(
			[
				server("s1", "user", "where is my order?"),
				server("s2", "admin", "checking now"),
			],
			[
				local("l1", "user", "where is my order?"),
				local("l2", "assistant", ESCALATED_HOLDING_MESSAGE),
			],
		);
		expect(merged.map((m) => m.id)).toEqual(["s1", "l2", "s2"]);
	});

	it("marks only persisted assistant messages rateable", () => {
		const merged = mergeMessages(
			[server("s1", "user", "hi"), server("s2", "assistant", "hello!", "up")],
			[local("l3", "assistant", "streaming")],
		);
		expect(merged.find((m) => m.id === "s2")).toMatchObject({
			rateable: true,
			rating: "up",
		});
		expect(merged.find((m) => m.id === "l3")?.rateable).toBeUndefined();
	});

	// The server branch builds each ChatMessage by copying fields EXPLICITLY, so a
	// new ServerMessage field is silently dropped unless it's forwarded there. That
	// bug is invisible in the widget (the chip renders optimistically from local
	// state, then vanishes on the next poll) — these pin the round-trip.
	describe("quote-reply survives the merge", () => {
		it("carries replyToMessageId through from a persisted server row", () => {
			const quoted = server("s1", "assistant", "ships Tuesday");
			const reply: ServerMessage = {
				...server("s2", "user", "which one?"),
				replyToMessageId: "s1",
			};
			const merged = mergeMessages([quoted, reply], []);

			expect(merged.find((m) => m.id === "s2")?.replyToMessageId).toBe("s1");
			// A non-reply gets an explicit null, never undefined — so a consumer can
			// distinguish "not a reply" from "field lost in transit".
			expect(merged.find((m) => m.id === "s1")?.replyToMessageId).toBeNull();
		});

		it("carries it on an in-flight local message (optimistic chip)", () => {
			const merged = mergeMessages(
				[server("s1", "assistant", "ships Tuesday")],
				[{ ...local("l1", "user", "which one?"), replyToMessageId: "s1" }],
			);
			expect(merged.find((m) => m.id === "l1")?.replyToMessageId).toBe("s1");
		});

		it("keeps the reference when the local message is replaced by its server row", () => {
			// The poll catches up: the local copy is matched and dropped, and the
			// persisted row (with the SERVER-validated reference) renders instead.
			const merged = mergeMessages(
				[
					server("s1", "assistant", "ships Tuesday"),
					{ ...server("s2", "user", "which one?"), replyToMessageId: "s1" },
				],
				[{ ...local("l1", "user", "which one?"), replyToMessageId: "s1" }],
			);
			expect(merged.map((m) => m.id)).toEqual(["s1", "s2"]);
			expect(merged[1]?.replyToMessageId).toBe("s1");
		});
	});
});
