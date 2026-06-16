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
		createdAt: "2026-06-16T05:00:00.000Z",
		...overrides,
	};
}

function sideOf(text: string): string | null {
	return (
		screen.getByText(text).closest("[data-side]")?.getAttribute("data-side") ??
		null
	);
}

describe("MessageThread", () => {
	it("renders system messages as a centered note with no role label", () => {
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
		expect(screen.getByText("Visitor requested a human operator")).toHaveClass(
			"mx-auto",
		);
		// System notes carry no Visitor/Bot/Admin label.
		expect(screen.queryByText("Visitor")).not.toBeInTheDocument();
		expect(screen.queryByText("Admin")).not.toBeInTheDocument();
	});

	it("puts the visitor on the left and the bot/admin on the right", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "I need help", sequence: 1 }),
					msg({ role: "assistant", content: "Hi there", sequence: 2 }),
					msg({ role: "admin", content: "On it!", sequence: 3 }),
				]}
			/>,
		);
		expect(sideOf("I need help")).toBe("left");
		expect(sideOf("Hi there")).toBe("right");
		expect(sideOf("On it!")).toBe("right");
		// Role labels are shown for bubbles.
		expect(screen.getByText("Visitor")).toBeInTheDocument();
		expect(screen.getByText("Bot")).toBeInTheDocument();
		expect(screen.getByText("Admin")).toBeInTheDocument();
	});

	it("shows an empty state when there are no messages", () => {
		render(<MessageThread messages={[]} />);
		expect(
			screen.getByText(/no messages in this conversation/i),
		).toBeInTheDocument();
	});
});
