import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageThread } from "./MessageThread";

import type { Message } from "./types";

function msg(overrides: Partial<Message>): Message {
	return {
		id: crypto.randomUUID(),
		role: "user",
		content: "hello",
		sequence: 1,
		createdAt: 0,
		...overrides,
	};
}

describe("MessageThread", () => {
	it("renders system messages as a centered note without a role label", () => {
		render(
			<MessageThread
				messages={[
					msg({
						role: "system",
						content: "Visitor requested a human operator",
					}),
				]}
			/>,
		);
		const note = screen.getByText("Visitor requested a human operator");
		expect(note).toHaveClass("mx-auto");
		// Bubble messages print their role label; the system note must not.
		expect(screen.queryByText("system")).not.toBeInTheDocument();
	});

	it("keeps visitor and admin bubbles on opposite sides of the thread", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "I need help", sequence: 1 }),
					msg({ role: "admin", content: "On it!", sequence: 2 }),
					msg({ role: "assistant", content: "Hi there", sequence: 3 }),
				]}
			/>,
		);
		expect(screen.getByText("I need help").parentElement).toHaveClass(
			"ml-auto",
		);
		expect(screen.getByText("On it!").parentElement).toHaveClass("ml-auto");
		expect(screen.getByText("Hi there").parentElement).not.toHaveClass(
			"ml-auto",
		);
		// Role labels stay visible for bubbles.
		expect(screen.getByText("admin")).toBeInTheDocument();
	});
});
