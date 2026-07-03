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
});
