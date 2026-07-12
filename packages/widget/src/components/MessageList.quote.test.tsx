import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageList } from "./MessageList";

import type { DisplayMessage } from "./MessageList";

const AGENT: DisplayMessage = {
	id: "a1",
	role: "assistant",
	content: "Your order ships on Tuesday.",
};
const VISITOR_REPLY: DisplayMessage = {
	id: "u2",
	role: "user",
	content: "which one?",
	replyToMessageId: "a1",
};

function list(
	messages: DisplayMessage[],
	onReply?: (m: DisplayMessage) => void,
) {
	return render(
		<MessageList
			greeting="hi"
			messages={messages}
			typing={false}
			error={null}
			onReply={onReply}
		/>,
	);
}

describe("MessageList — quote chip", () => {
	it("renders the quoted message above the reply when it's in the loaded thread", () => {
		list([AGENT, VISITOR_REPLY]);

		// The chip names who was quoted and shows their text — the agent's reply now
		// appears twice: once as its own bubble, once quoted.
		expect(screen.getByText("Agent")).toBeInTheDocument();
		expect(screen.getAllByText("Your order ships on Tuesday.")).toHaveLength(2);
	});

	it("falls back to a neutral label when the quoted message isn't loaded", () => {
		// The visitor replied to a message in an older page (or one since deleted):
		// the reference is intact, the target isn't here.
		list([{ ...VISITOR_REPLY, replyToMessageId: "gone" }]);

		expect(screen.getByText("Earlier message")).toBeInTheDocument();
		// Never renders as if it were addressed to nothing.
		expect(screen.getByText("which one?")).toBeInTheDocument();
	});

	it("renders no chip on a message that isn't a reply", () => {
		list([AGENT]);
		expect(screen.queryByText("Earlier message")).not.toBeInTheDocument();
	});
});

describe("MessageList — reply affordance", () => {
	it("hands the message to onReply when the visitor picks Reply", async () => {
		const onReply = vi.fn();
		list([AGENT], onReply);

		await userEvent.click(screen.getByLabelText("Reply to this message"));

		expect(onReply).toHaveBeenCalledWith(AGENT);
	});

	it("offers Reply on every message the visitor can see (agent, own, operator)", () => {
		list(
			[
				AGENT,
				{ id: "u1", role: "user", content: "hi" },
				{ id: "ad1", role: "admin", content: "A human here." },
			],
			vi.fn(),
		);
		expect(screen.getAllByLabelText("Reply to this message")).toHaveLength(3);
	});

	it("offers no Reply on internal system rows", () => {
		list(
			[{ id: "s1", role: "system", content: "Visitor requested a human" }],
			vi.fn(),
		);
		expect(
			screen.queryByLabelText("Reply to this message"),
		).not.toBeInTheDocument();
	});

	it("hides the affordance entirely when onReply is omitted", () => {
		list([AGENT]);
		expect(
			screen.queryByLabelText("Reply to this message"),
		).not.toBeInTheDocument();
	});
});
