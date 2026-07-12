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
		createdAt: "2026-07-12T05:00:00.000Z",
		...overrides,
	};
}

const AGENT = msg({
	id: "a1",
	role: "assistant",
	content: "Your order ships on Tuesday.",
	sequence: 1,
});

describe("MessageThread — quote-reply chip", () => {
	it("shows the operator which message the visitor was replying to", () => {
		render(
			<MessageThread
				messages={[
					AGENT,
					msg({
						id: "u2",
						role: "user",
						content: "which one?",
						sequence: 2,
						replyToMessageId: "a1",
					}),
				]}
			/>,
		);

		// The quoted agent reply appears twice: its own bubble + the chip on the
		// visitor's reply. That's the whole point — the operator sees the pairing.
		expect(screen.getAllByText("Your order ships on Tuesday.")).toHaveLength(2);
		// "Agent" labels both the quoted author (chip) and the bubble's own header.
		expect(screen.getAllByText("Agent").length).toBeGreaterThanOrEqual(2);
	});

	it("falls back to a neutral chip when the quoted message is outside the loaded window", () => {
		// Paged-out history (or a deleted message): the reference survives, the target
		// isn't in this window. The chip must still render — a reply with no visible
		// context is worse than a labelled one.
		render(
			<MessageThread
				messages={[
					msg({
						id: "u2",
						role: "user",
						content: "which one?",
						sequence: 2,
						replyToMessageId: "in_an_older_page",
					}),
				]}
			/>,
		);

		expect(screen.getByText("Earlier message")).toBeInTheDocument();
		expect(screen.getByText("not in the loaded thread")).toBeInTheDocument();
		expect(screen.getByText("which one?")).toBeInTheDocument();
	});

	it("renders no chip on a message that isn't a reply", () => {
		render(<MessageThread messages={[AGENT]} />);
		expect(screen.queryByText("Earlier message")).not.toBeInTheDocument();
	});
});
