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
		csatRating: null,
		firstMessage: "How do I reset my device?",
		...overrides,
	};
}

function setup(
	props: Partial<React.ComponentProps<typeof ConversationList>> = {},
) {
	const onSelect = vi.fn();
	render(
		<ConversationList
			conversations={[conv({ id: "a" })]}
			selectedId={null}
			onSelect={onSelect}
			search=""
			status="open"
			{...props}
		/>,
	);
	return { onSelect };
}

describe("ConversationList", () => {
	it("shows name, message preview and count for each row", () => {
		setup();
		expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
		expect(screen.getByText("How do I reset my device?")).toBeInTheDocument();
		expect(screen.getByText("3 messages")).toBeInTheDocument();
	});

	it("uses a singular label for a single message", () => {
		setup({ conversations: [conv({ id: "a", messageCount: 1 })] });
		expect(screen.getByText("1 message")).toBeInTheDocument();
	});

	it("shows an unread marker only for unread conversations", () => {
		const { rerender } = render(
			<ConversationList
				conversations={[conv({ id: "a", unread: true })]}
				selectedId={null}
				onSelect={vi.fn()}
				search=""
				status="open"
			/>,
		);
		expect(screen.getByLabelText("Unread")).toBeInTheDocument();

		rerender(
			<ConversationList
				conversations={[conv({ id: "a", unread: false })]}
				selectedId={null}
				onSelect={vi.fn()}
				search=""
				status="open"
			/>,
		);
		expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
	});

	it("hides the unread marker for the open conversation", () => {
		render(
			<ConversationList
				conversations={[conv({ id: "a", unread: true })]}
				selectedId="a"
				onSelect={vi.fn()}
				search=""
				status="open"
			/>,
		);
		expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
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

	it("shows the match snippet with the term highlighted when searching", () => {
		setup({
			search: "refund",
			conversations: [
				conv({
					id: "m",
					match: { field: "body", snippet: "our refund policy is 30 days" },
				}),
			],
		});
		// The snippet replaces the default preview, with the term in a <mark>.
		const mark = screen.getByText("refund");
		expect(mark.tagName).toBe("MARK");
		expect(
			screen.queryByText("How do I reset my device?"),
		).not.toBeInTheDocument();
	});

	it("labels a name/email match so the agent sees why it surfaced", () => {
		setup({
			search: "ada",
			conversations: [
				conv({ id: "m", match: { field: "name", snippet: "Ada Lovelace" } }),
			],
		});
		expect(screen.getByText("Name")).toBeInTheDocument();
	});

	it("falls back to email then a placeholder when there's no first message", () => {
		setup({
			conversations: [conv({ id: "x", firstMessage: null, name: "No Msg" })],
		});
		expect(screen.getByText("ada@example.com")).toBeInTheDocument();
	});

	it("prefers the AI summary over the first-message snippet in the preview", () => {
		setup({
			conversations: [
				conv({
					id: "s",
					summary: "Refund request for order #1234",
					firstMessage: "How do I reset my device?",
				}),
			],
		});
		expect(
			screen.getByText("Refund request for order #1234"),
		).toBeInTheDocument();
		// The summary replaces the raw snippet — no double preview line.
		expect(
			screen.queryByText("How do I reset my device?"),
		).not.toBeInTheDocument();
	});

	it("falls back to the snippet when no summary exists yet (honest, no placeholder)", () => {
		setup({
			conversations: [
				conv({ id: "s", summary: null, firstMessage: "Where is my order?" }),
			],
		});
		expect(screen.getByText("Where is my order?")).toBeInTheDocument();
	});

	it("lets a search match still win over the summary while searching", () => {
		setup({
			search: "refund",
			conversations: [
				conv({
					id: "s",
					summary: "Asking about shipping times",
					match: { field: "body", snippet: "our refund policy is 30 days" },
				}),
			],
		});
		expect(screen.getByText("refund").tagName).toBe("MARK");
		expect(
			screen.queryByText("Asking about shipping times"),
		).not.toBeInTheDocument();
	});

	it("reports the selected conversation upward", async () => {
		const user = userEvent.setup();
		const { onSelect } = setup();

		await user.click(screen.getByText("Ada Lovelace"));
		expect(onSelect).toHaveBeenCalledWith("a");
	});

	it("distinguishes the empty states", () => {
		const { rerender } = render(
			<ConversationList
				conversations={[]}
				selectedId={null}
				onSelect={vi.fn()}
				search="zzz"
				status="open"
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
				status="resolved"
			/>,
		);
		expect(screen.getByText(/no resolved conversations/i)).toBeInTheDocument();
	});

	it("keeps rows reachable for selection", () => {
		setup({ conversations: [conv({ id: "a", name: "Row A" })] });
		const list = screen.getByRole("list");
		expect(within(list).getByText("Row A")).toBeInTheDocument();
	});
});
