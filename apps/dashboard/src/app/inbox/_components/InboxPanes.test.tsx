import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxPanes, type InboxPanesProps } from "./InboxPanes";
import { MessageThread } from "./MessageThread";
import type { Message } from "./types";

function renderPanes(overrides: Partial<InboxPanesProps> = {}) {
	const props: InboxPanesProps = {
		hasSelection: false,
		onBack: vi.fn(),
		detailsOpen: false,
		onDetailsOpenChange: vi.fn(),
		list: <div data-testid="list">LIST</div>,
		threadHeader: <div data-testid="thread-header">HEADER</div>,
		threadBody: <div data-testid="thread-body">BODY</div>,
		composer: <div data-testid="composer">COMPOSER</div>,
		details: <div data-testid="details">DETAILS</div>,
		emptyState: <div data-testid="empty">Select a conversation</div>,
		detailsEmptyState: <div data-testid="details-empty">No details</div>,
		...overrides,
	};
	return { props, ...render(<InboxPanes {...props} />) };
}

const back = () =>
	screen.getByRole("button", { name: /back to conversations/i });
const backQuery = () =>
	screen.queryByRole("button", { name: /back to conversations/i });
const detailsBtn = () =>
	screen.queryByRole("button", { name: /conversation details/i });

describe("InboxPanes navigation (list ↔ thread ↔ back)", () => {
	it("with no selection shows the list and the empty state — no thread chrome", () => {
		renderPanes({ hasSelection: false });
		expect(screen.getByTestId("list")).toBeInTheDocument();
		expect(screen.getByTestId("empty")).toBeInTheDocument();
		// The thread header/body/composer and the back button only exist once open.
		expect(screen.queryByTestId("thread-body")).not.toBeInTheDocument();
		expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
		expect(backQuery()).not.toBeInTheDocument();
		expect(detailsBtn()).not.toBeInTheDocument();
	});

	it("with a selection reveals the thread (header + body + composer) and a back button", () => {
		renderPanes({ hasSelection: true });
		expect(screen.getByTestId("thread-header")).toBeInTheDocument();
		expect(screen.getByTestId("thread-body")).toBeInTheDocument();
		expect(screen.getByTestId("composer")).toBeInTheDocument();
		expect(back()).toBeInTheDocument();
		// The list stays mounted (CSS-hidden on mobile) so it never re-fetches/re-scrolls.
		expect(screen.getByTestId("list")).toBeInTheDocument();
	});

	it("the back button returns to the list (calls onBack)", async () => {
		const onBack = vi.fn();
		renderPanes({ hasSelection: true, onBack });
		await userEvent.click(back());
		expect(onBack).toHaveBeenCalledTimes(1);
	});
});

describe("InboxPanes contact-details toggle", () => {
	it("the details button opens the sheet (calls onDetailsOpenChange)", async () => {
		const onDetailsOpenChange = vi.fn();
		renderPanes({ hasSelection: true, onDetailsOpenChange });
		const btn = detailsBtn();
		expect(btn).toBeInTheDocument();
		await userEvent.click(btn!);
		expect(onDetailsOpenChange).toHaveBeenCalledWith(true);
	});

	it("renders no details affordance when there is no details panel", () => {
		renderPanes({ hasSelection: true, details: null });
		expect(detailsBtn()).not.toBeInTheDocument();
	});

	it("the details sheet (a dialog) appears only when open", () => {
		const { rerender, props } = renderPanes({
			hasSelection: true,
			detailsOpen: false,
		});
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		rerender(<InboxPanes {...props} hasSelection detailsOpen />);
		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByTestId("details")).toBeInTheDocument();
	});
});

/**
 * jsdom has no layout. Install a controllable scroll model so the reused
 * stick-to-bottom hook (inside MessageThread) behaves like a real container.
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

/** The MessageThread scroll container, as mounted inside the thread pane. */
function threadScroller(container: HTMLElement): HTMLElement {
	return container.querySelector<HTMLElement>(
		'[data-pane="thread"] .overflow-y-auto',
	)!;
}

describe("InboxPanes reuses MessageThread search + scroll logic in the mobile thread", () => {
	// MessageThread scrolls the first hit into view; jsdom lacks scrollIntoView.
	let scrollSpy: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		scrollSpy = vi.fn();
		Element.prototype.scrollIntoView = scrollSpy;
	});
	afterEach(() => {
		delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
	});

	it("highlights the active term and scrolls to the first hit inside the thread pane", () => {
		const { container } = renderPanes({
			hasSelection: true,
			details: null,
			threadBody: (
				<MessageThread
					messages={[
						msg({ role: "user", content: "I want a Refund", sequence: 1 }),
						msg({
							role: "assistant",
							content: "your refund is processing",
							sequence: 2,
						}),
					]}
					search="refund"
				/>
			),
		});
		// Highlight component reused: every occurrence marked (case-insensitive).
		const marks = [...container.querySelectorAll("mark")].map((m) =>
			(m.textContent ?? "").toLowerCase(),
		);
		expect(marks).toEqual(["refund", "refund"]);
		// Scroll-to-first-hit reused: exactly one scroll, onto the first match.
		expect(scrollSpy).toHaveBeenCalledTimes(1);
		const hit = container.querySelector('[data-search-hit="true"]');
		expect(hit?.textContent).toContain("I want a Refund");
	});

	it("keeps stick-to-bottom: follows the agent's own reply but not inbound while scrolled up", () => {
		const base = [
			msg({ content: "hi", sequence: 1 }),
			msg({ role: "assistant", content: "hello", sequence: 2 }),
		];
		// Re-rendering with a fresh MessageThread in the same DOM position swaps the
		// messages prop without remounting — exactly like a live inbox refetch.
		const { container, props, rerender } = renderPanes({
			hasSelection: true,
			details: null,
			threadBody: <MessageThread messages={base} />,
		});
		const el = threadScroller(container);
		const s = mockScroll(el, { scrollHeight: 1000, clientHeight: 400 });
		s.setTop(0); // agent has scrolled up reading history

		// An inbound visitor message must NOT yank them to the bottom.
		rerender(
			<InboxPanes
				{...props}
				threadBody={
					<MessageThread
						messages={[...base, msg({ content: "ping", sequence: 3 })]}
					/>
				}
			/>,
		);
		expect(s.top).toBe(0);

		// The agent's own reply (role admin) DOES follow to the bottom.
		rerender(
			<InboxPanes
				{...props}
				threadBody={
					<MessageThread
						messages={[
							...base,
							msg({ role: "admin", content: "on it", sequence: 3 }),
						]}
					/>
				}
			/>,
		);
		expect(s.top).toBe(1000);
	});
});
