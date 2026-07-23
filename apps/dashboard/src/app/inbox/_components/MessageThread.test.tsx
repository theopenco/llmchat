import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageThread } from "./MessageThread";
import {
	appendOptimisticNote,
	appendOptimisticReply,
} from "./optimistic-updaters";

import type { Conversation, Message } from "./types";

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
		expect(
			screen.getByText("Visitor requested a human operator").closest("div"),
		).toHaveClass("mx-auto");
		// System notes carry no Visitor/Bot/Admin label.
		expect(screen.queryByText("Visitor")).not.toBeInTheDocument();
		expect(screen.queryByText("Admin")).not.toBeInTheDocument();
	});

	it("puts the AI agent on the left and the visitor/you on the right", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "I need help", sequence: 1 }),
					msg({ role: "assistant", content: "Hi there", sequence: 2 }),
					msg({ role: "admin", content: "On it!", sequence: 3 }),
				]}
			/>,
		);
		expect(sideOf("I need help")).toBe("right");
		expect(sideOf("Hi there")).toBe("left");
		expect(sideOf("On it!")).toBe("right");
		// Role labels are shown for bubbles.
		expect(screen.getByText("Visitor")).toBeInTheDocument();
		expect(screen.getByText("Agent")).toBeInTheDocument();
		expect(screen.getByText("You")).toBeInTheDocument();
	});

	it("renders an internal note as the amber Internal card — never a visitor bubble", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "I need help", sequence: 1 }),
					msg({
						role: "note",
						content: "VIP customer — comp the order",
						sequence: 2,
						authorName: "Omar Owner",
					}),
				]}
			/>,
		);
		const card = screen
			.getByText("VIP customer — comp the order")
			.closest("[data-note]");
		// The note is its own card, NOT inside a sided bubble (the old fallback
		// rendered unknown roles as a Visitor bubble — the exact mispresentation
		// this branch exists to prevent).
		expect(card).toBeInTheDocument();
		expect(card?.closest("[data-side]")).toBeNull();
		expect(
			screen.getByText(/Internal — Omar Owner · visible to your team only/),
		).toBeInTheDocument();
	});

	it("falls back to a generic author label when the note's author was deleted", () => {
		render(
			<MessageThread
				messages={[
					msg({
						role: "note",
						content: "orphan note",
						sequence: 1,
						authorName: null,
					}),
				]}
			/>,
		);
		expect(
			screen.getByText(
				/Internal — a former teammate · visible to your team only/,
			),
		).toBeInTheDocument();
	});

	it("never offers Promote-to-knowledge on a note (admin replies only)", () => {
		render(
			<MessageThread
				messages={[
					msg({
						role: "note",
						content: "note body",
						sequence: 1,
						authorName: "Omar Owner",
					}),
				]}
				knowledge={{
					projectId: "p1",
					projectName: "Acme",
					workspaceId: "ws1",
				}}
			/>,
		);
		expect(screen.queryByText(/add to knowledge/i)).not.toBeInTheDocument();
	});

	it("shows an empty state when there are no messages", () => {
		render(<MessageThread messages={[]} />);
		expect(
			screen.getByText(/no messages in this conversation/i),
		).toBeInTheDocument();
	});

	it("surfaces the per-message rating on assistant replies", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "assistant", content: "up reply", rating: "up" }),
					msg({ role: "assistant", content: "down reply", rating: "down" }),
					msg({ role: "assistant", content: "neutral reply", rating: null }),
				]}
			/>,
		);
		expect(screen.getByText("Helpful")).toBeInTheDocument();
		expect(screen.getByText("Not helpful")).toBeInTheDocument();
		expect(screen.getByText("Not rated")).toBeInTheDocument();
	});

	it("does not show a rating indicator on visitor or admin messages", () => {
		render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "hi", rating: "up" }),
					msg({ role: "admin", content: "hello", rating: "down" }),
				]}
			/>,
		);
		// No rating chips render for non-assistant roles, even if data carried one.
		expect(screen.queryByText("Helpful")).not.toBeInTheDocument();
		expect(screen.queryByText("Not helpful")).not.toBeInTheDocument();
		expect(screen.queryByText("Not rated")).not.toBeInTheDocument();
	});
});

/**
 * jsdom has no layout, so install a controllable scroll model: fixed
 * scrollHeight/clientHeight and a backing scrollTop the stick-to-bottom hook
 * reads and writes. setTop() also fires a scroll event so the hook updates its
 * near-bottom tracking, like a real scroll.
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

function renderThread(messages: Message[]) {
	const utils = render(<MessageThread messages={messages} />);
	const el = utils.container.firstElementChild as HTMLElement;
	return { ...utils, el };
}

describe("MessageThread auto-scroll (useStickToBottom)", () => {
	it("follows a new message when the agent is near the bottom", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(620); // near bottom

		rerender(
			<MessageThread
				messages={[...base, msg({ content: "another", sequence: 3 })]}
			/>,
		);
		expect(s.top).toBe(1000);
	});

	it("does NOT yank the agent down when they've scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // scrolled up reading history

		// A new inbound visitor message arrives via refetch.
		rerender(
			<MessageThread
				messages={[...base, msg({ content: "ping", sequence: 3 })]}
			/>,
		);
		expect(s.top).toBe(0);
	});

	it("does not jump to the bottom when opening a conversation with history", () => {
		const history = Array.from({ length: 10 }, (_, i) =>
			msg({
				role: i % 2 ? "assistant" : "user",
				content: `line ${i}`,
				sequence: i + 1,
			}),
		);
		const { el } = renderThread(history);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		expect(s.top).toBe(0);
	});

	it("follows the agent's own reply (admin) even if scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // scrolled up

		// Agent sends a reply (role "admin") — user-initiated, should follow.
		rerender(
			<MessageThread
				messages={[
					...base,
					msg({ role: "admin", content: "on it!", sequence: 3 }),
				]}
			/>,
		);
		expect(s.top).toBe(1000);
	});

	it("follows an optimistic reply (built by appendOptimisticReply) even when scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // agent reading history, scrolled up

		// The exact array the inbox's optimistic reply writes into the thread cache.
		const next = appendOptimisticReply(
			{ conversation: { id: "c1" } as Conversation, messages: base },
			{
				tempId: "temp-1",
				content: "on it!",
				createdAt: "2026-06-16T05:00:00.000Z",
			},
		) as { messages: Message[] };

		rerender(<MessageThread messages={next.messages} />);
		// Role "admin" => stick-to-bottom treats it as the agent's own send.
		expect(s.top).toBe(1000);
	});

	it("follows the agent's own note (built by appendOptimisticNote) even when scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // scrolled up reading history

		// The exact array the inbox's optimistic note writes into the thread cache.
		const next = appendOptimisticNote(
			{ conversation: { id: "c1" } as Conversation, messages: base },
			{
				tempId: "temp-n1",
				content: "VIP customer — comp the order",
				createdAt: "2026-07-23T05:00:00.000Z",
				authorName: "Omar Owner",
			},
		) as { messages: Message[] };

		rerender(<MessageThread messages={next.messages} />);
		// Role "note" => own-send too: adding a note follows to the bottom
		// exactly like sending a reply.
		expect(s.top).toBe(1000);
	});

	it("shows the scroll-to-latest button when scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		const { el, container } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0);
		expect(
			container.querySelector('[aria-label="Scroll to latest message"]'),
		).toBeInTheDocument();
	});
});

describe("MessageThread pagination (load older)", () => {
	function olderThenNewer() {
		return {
			base: [
				msg({ id: "n1", content: "newer 1", sequence: 51 }),
				msg({ id: "n2", content: "newer 2", sequence: 52 }),
			],
			prepended: [
				// Older history paged in ABOVE — the last (newest) message is unchanged.
				msg({ id: "o1", content: "older 1", sequence: 49 }),
				msg({ id: "o2", content: "older 2", sequence: 50 }),
				msg({ id: "n1", content: "newer 1", sequence: 51 }),
				msg({ id: "n2", content: "newer 2", sequence: 52 }),
			],
		};
	}

	it("does NOT yank to the bottom when older history is prepended", () => {
		const { base, prepended } = olderThenNewer();
		const { el, rerender } = renderThread(base);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // reading the top of the loaded window

		rerender(<MessageThread messages={prepended} />);
		// The newest-message id is unchanged, so stick-to-bottom never fires.
		expect(s.top).not.toBe(1000);
		expect(s.top).toBe(0);
	});

	it("anchors the viewport: scrollTop shifts down by the prepended height", () => {
		const { base, prepended } = olderThenNewer();
		const { el, rerender } = renderThread(base);

		// Dynamic scrollHeight: prepending older content grows the scroll area.
		let height = 1000;
		let top = 0;
		Object.defineProperty(el, "scrollHeight", {
			configurable: true,
			get: () => height,
		});
		Object.defineProperty(el, "clientHeight", {
			configurable: true,
			get: () => 400,
		});
		Object.defineProperty(el, "scrollTop", {
			configurable: true,
			get: () => top,
			set: (v: number) => {
				top = v;
			},
		});
		act(() => el.dispatchEvent(new Event("scroll"))); // commit initial metrics

		height = 1300; // 300px of older messages added on top
		rerender(<MessageThread messages={prepended} />);
		// Anchored: the message the user was viewing stays put, pushed down by 300.
		expect(top).toBe(300);
	});

	it("shows a Load-older control only when hasOlder, and fires onLoadOlder", () => {
		const onLoadOlder = vi.fn();
		const { rerender } = render(
			<MessageThread messages={[msg({ content: "hi", sequence: 1 })]} />,
		);
		expect(
			screen.queryByRole("button", { name: /load older/i }),
		).not.toBeInTheDocument();

		rerender(
			<MessageThread
				messages={[msg({ content: "hi", sequence: 1 })]}
				hasOlder
				onLoadOlder={onLoadOlder}
			/>,
		);
		const btn = screen.getByRole("button", { name: /load older/i });
		fireEvent.click(btn);
		expect(onLoadOlder).toHaveBeenCalledTimes(1);
	});
});

describe("MessageThread search highlighting", () => {
	// jsdom has no layout and doesn't implement scrollIntoView; install a spy so
	// the scroll-to-first-hit effect runs (and is assertable) like in a browser.
	let scrollSpy: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		scrollSpy = vi.fn();
		Element.prototype.scrollIntoView = scrollSpy;
	});
	afterEach(() => {
		delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
	});

	function lowerMarks(container: HTMLElement): string[] {
		return [...container.querySelectorAll("mark")].map((m) =>
			(m.textContent ?? "").toLowerCase(),
		);
	}

	it("highlights the term across visitor and bot messages (case-insensitive)", () => {
		const { container } = render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "I want a Refund please", sequence: 1 }),
					msg({
						role: "assistant",
						content: "Your refund is on the way",
						sequence: 2,
					}),
				]}
				search="refund"
			/>,
		);
		const marks = lowerMarks(container);
		expect(marks).toHaveLength(2);
		expect(marks.every((t) => t === "refund")).toBe(true);
	});

	it("marks every occurrence within a single message", () => {
		const { container } = render(
			<MessageThread
				messages={[msg({ content: "refund then refund again", sequence: 1 })]}
				search="refund"
			/>,
		);
		expect(container.querySelectorAll("mark")).toHaveLength(2);
	});

	it("escapes HTML in a message — highlighting can't inject", () => {
		const { container } = render(
			<MessageThread
				messages={[
					msg({
						content: 'evil <img src=x onerror="alert(1)"> refund',
						sequence: 1,
					}),
				]}
				search="refund"
			/>,
		);
		// The tag is inert text, not a real element…
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toContain("<img src=x onerror=");
		// …and the term is still highlighted.
		expect(lowerMarks(container)).toEqual(["refund"]);
	});

	it("renders no marks when the search term is empty (highlights clear)", () => {
		const { container, rerender } = render(
			<MessageThread
				messages={[msg({ content: "a refund here", sequence: 1 })]}
				search="refund"
			/>,
		);
		expect(container.querySelectorAll("mark")).toHaveLength(1);

		rerender(
			<MessageThread
				messages={[msg({ content: "a refund here", sequence: 1 })]}
				search=""
			/>,
		);
		expect(container.querySelectorAll("mark")).toHaveLength(0);
	});

	it("scrolls the first matching message into view on open", () => {
		const { container } = render(
			<MessageThread
				messages={[
					msg({ role: "user", content: "hello there", sequence: 1 }),
					msg({
						role: "assistant",
						content: "about your refund policy",
						sequence: 2,
					}),
					msg({ role: "user", content: "the refund again", sequence: 3 }),
				]}
				search="refund"
			/>,
		);
		// Exactly one scroll, onto the FIRST matching message's bubble.
		expect(scrollSpy).toHaveBeenCalledTimes(1);
		const hit = container.querySelector('[data-search-hit="true"]');
		expect(hit?.textContent).toContain("about your refund policy");
		expect(scrollSpy.mock.contexts[0]).toBe(hit);
	});

	it("does not scroll when there's no active search term", () => {
		render(
			<MessageThread
				messages={[msg({ content: "a refund here", sequence: 1 })]}
			/>,
		);
		expect(scrollSpy).not.toHaveBeenCalled();
	});
});
