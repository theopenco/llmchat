import { act, render, screen } from "@testing-library/react";
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

/**
 * jsdom has no layout, so we install a controllable scroll model on the
 * container: fixed scrollHeight/clientHeight and a backing scrollTop the hook
 * reads and writes. setTop() also fires a scroll event so the hook updates its
 * near-bottom tracking, exactly as a real scroll would.
 */
function mockScroll(
	el: HTMLElement,
	{
		scrollHeight,
		clientHeight,
	}: { scrollHeight: number; clientHeight: number },
) {
	let top = 0;
	Object.defineProperty(el, "scrollHeight", {
		configurable: true,
		get: () => scrollHeight,
	});
	Object.defineProperty(el, "clientHeight", {
		configurable: true,
		get: () => clientHeight,
	});
	Object.defineProperty(el, "scrollTop", {
		configurable: true,
		get: () => top,
		set: (v: number) => {
			top = v;
		},
	});
	return {
		setTop(v: number) {
			top = v;
			act(() => el.dispatchEvent(new Event("scroll")));
		},
		get top() {
			return top;
		},
	};
}

const msg = (id: string, role: string, content: string): DisplayMessage => ({
	id,
	role,
	content,
});

function renderList(messages: DisplayMessage[], typing = false) {
	const utils = render(
		<MessageList
			greeting="hi"
			messages={messages}
			typing={typing}
			error={null}
		/>,
	);
	const el = utils.container.querySelector(".llmchat-messages") as HTMLElement;
	return { ...utils, el };
}

describe("MessageList auto-scroll (useStickToBottom)", () => {
	it("stays pinned to the bottom as a reply streams when near the bottom", () => {
		const user = msg("u1", "user", "hello there");
		const { el, rerender } = renderList([user], true);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(620); // 1000 - 620 - 400 = -20 ≤ 100 → near bottom

		rerender(
			<MessageList
				greeting="hi"
				messages={[user, msg("a1", "assistant", "streaming answer so far…")]}
				typing
				error={null}
			/>,
		);
		expect(s.top).toBe(1000); // followed to the bottom
	});

	it("does NOT scroll when the user has scrolled up to read earlier messages", () => {
		const user = msg("u1", "user", "hello there");
		const { el, rerender } = renderList([user], true);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // 1000 - 0 - 400 = 600 > 100 → scrolled up

		rerender(
			<MessageList
				greeting="hi"
				messages={[user, msg("a1", "assistant", "a long streaming answer…")]}
				typing
				error={null}
			/>,
		);
		expect(s.top).toBe(0); // left alone — no yank
	});

	it("does not jump to the bottom when mounting with existing history", () => {
		const history = Array.from({ length: 8 }, (_, i) =>
			msg(`m${i}`, i % 2 ? "assistant" : "user", `message ${i}`),
		);
		const { el } = renderList(history, false);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		expect(s.top).toBe(0);
	});

	it("follows the visitor's own sent message even if they were scrolled up", () => {
		const a1 = msg("a1", "assistant", "previous answer");
		const { el, rerender } = renderList([a1], false);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // scrolled up

		rerender(
			<MessageList
				greeting="hi"
				messages={[a1, msg("u2", "user", "a new question")]}
				typing={false}
				error={null}
			/>,
		);
		expect(s.top).toBe(1000); // user-initiated → always follows
	});

	it("does not scroll on a rating-only re-render", () => {
		const a1: DisplayMessage = {
			id: "a1",
			role: "assistant",
			content: "answer",
			rateable: true,
		};
		const { el, rerender } = renderList([a1], false);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // scrolled up

		rerender(
			<MessageList
				greeting="hi"
				messages={[{ ...a1, rating: "up" }]}
				typing={false}
				error={null}
				onRate={() => {}}
			/>,
		);
		expect(s.top).toBe(0); // rating change leaves the thread put
	});

	it("shows the scroll-to-latest button while streaming and scrolled up", () => {
		const user = msg("u1", "user", "hello");
		const { el, rerender, container } = renderList([user], true);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0);

		rerender(
			<MessageList
				greeting="hi"
				messages={[user, msg("a1", "assistant", "answering…")]}
				typing
				error={null}
			/>,
		);
		expect(container.querySelector(".llmchat-jump")).toBeInTheDocument();
	});
});
