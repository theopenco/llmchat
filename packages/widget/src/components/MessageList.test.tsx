import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageList } from "./MessageList";
import type { DisplayMessage } from "./MessageList";

const assistant = (over: Partial<DisplayMessage> = {}): DisplayMessage => ({
	id: "a1",
	role: "assistant",
	content: "Hello",
	rateable: true,
	rating: null,
	...over,
});

describe("MessageList rating", () => {
	it("shows thumbs on a rateable assistant message reflecting current state", () => {
		render(
			<MessageList
				greeting="hi"
				messages={[assistant({ rating: "up" })]}
				typing={false}
				error={null}
				onRate={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText("Helpful")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByLabelText("Not helpful")).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("calls onRate with the message id, current rating, and intent", async () => {
		const onRate = vi.fn();
		render(
			<MessageList
				greeting="hi"
				messages={[assistant({ rating: "up" })]}
				typing={false}
				error={null}
				onRate={onRate}
			/>,
		);
		await userEvent.click(screen.getByLabelText("Not helpful"));
		expect(onRate).toHaveBeenCalledWith("a1", "up", "down");
	});

	it("renders no thumbs for user messages", () => {
		render(
			<MessageList
				greeting="hi"
				messages={[{ id: "u1", role: "user", content: "hey" }]}
				typing={false}
				error={null}
				onRate={vi.fn()}
			/>,
		);
		expect(screen.queryByLabelText("Helpful")).not.toBeInTheDocument();
	});

	it("renders no thumbs when onRate is not provided", () => {
		render(
			<MessageList
				greeting="hi"
				messages={[assistant()]}
				typing={false}
				error={null}
			/>,
		);
		expect(screen.queryByLabelText("Helpful")).not.toBeInTheDocument();
	});
});
