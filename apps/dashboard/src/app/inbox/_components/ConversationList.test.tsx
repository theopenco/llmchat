import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConversationList } from "./ConversationList";

import type { Conversation } from "./types";

function conv(overrides: Partial<Conversation>): Conversation {
	return {
		id: crypto.randomUUID(),
		clientId: "c",
		name: "Ada Lovelace",
		email: "ada@example.com",
		ipAddress: null,
		userAgent: null,
		messageCount: 3,
		escalatedAt: null,
		archivedAt: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		firstMessage: "How do I reset my device?",
		...overrides,
	};
}

function setup(
	props: Partial<React.ComponentProps<typeof ConversationList>> = {},
) {
	const onSelect = vi.fn();
	const onSearch = vi.fn();
	const onToggleArchived = vi.fn();
	render(
		<ConversationList
			conversations={[conv({ id: "a" })]}
			selectedId={null}
			onSelect={onSelect}
			search=""
			onSearch={onSearch}
			showArchived={false}
			onToggleArchived={onToggleArchived}
			{...props}
		/>,
	);
	return { onSelect, onSearch, onToggleArchived };
}

describe("ConversationList", () => {
	it("shows name, message preview and count for each row", () => {
		setup();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("How do I reset my device?")).toBeInTheDocument();
		expect(screen.getByText(/3 messages/)).toBeInTheDocument();
	});

	it("marks escalated conversations with a badge", () => {
		setup({
			conversations: [
				conv({ id: "n", name: "Calm", escalatedAt: null }),
				conv({
					id: "e",
					name: "Angry",
					escalatedAt: "2026-06-16T05:01:00.000Z",
				}),
			],
		});
		// Only the escalated row carries the badge.
		const badges = screen.getAllByText("Escalated");
		expect(badges).toHaveLength(1);
	});

	it("falls back to email then a placeholder when there's no first message", () => {
		setup({
			conversations: [conv({ id: "x", firstMessage: null, name: "No Msg" })],
		});
		expect(screen.getByText("ada@example.com")).toBeInTheDocument();
	});

	it("reports the typed query and selection upward", async () => {
		const user = userEvent.setup();
		const { onSearch, onSelect } = setup();

		await user.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");

		await user.click(screen.getByText("Ada Lovelace"));
		expect(onSelect).toHaveBeenCalledWith("a");
	});

	it("toggles the archived view", async () => {
		const user = userEvent.setup();
		const { onToggleArchived } = setup();
		await user.click(screen.getByRole("button", { name: /archived/i }));
		expect(onToggleArchived).toHaveBeenCalled();
	});

	it("distinguishes the empty states", () => {
		const { rerender } = render(
			<ConversationList
				conversations={[]}
				selectedId={null}
				onSelect={vi.fn()}
				search="zzz"
				onSearch={vi.fn()}
				showArchived={false}
				onToggleArchived={vi.fn()}
			/>,
		);
		expect(
			screen.getByText(/no conversations match your search/i),
		).toBeInTheDocument();

		rerender(
			<ConversationList
				conversations={[]}
				selectedId={null}
				onSelect={vi.fn()}
				search=""
				onSearch={vi.fn()}
				showArchived
				onToggleArchived={vi.fn()}
			/>,
		);
		expect(screen.getByText(/no archived conversations/i)).toBeInTheDocument();
	});

	it("keeps rows reachable for selection", () => {
		setup({ conversations: [conv({ id: "a", name: "Row A" })] });
		const list = screen.getByRole("list");
		expect(within(list).getByText("Row A")).toBeInTheDocument();
	});
});
