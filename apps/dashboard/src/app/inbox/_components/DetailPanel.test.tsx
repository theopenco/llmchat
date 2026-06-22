import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DetailPanel } from "./DetailPanel";

import type { Conversation } from "./types";

function conv(overrides: Partial<Conversation> = {}): Conversation {
	return {
		id: "c1",
		clientId: "client",
		name: "Ada Lovelace",
		email: "ada@example.com",
		ipAddress: "203.0.113.7",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
		messageCount: 4,
		escalatedAt: null,
		archivedAt: null,
		createdAt: "2026-06-16T05:00:00.000Z",
		updatedAt: "2026-06-16T05:00:00.000Z",
		csatRating: null,
		...overrides,
	};
}

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

function setup(
	overrides: Partial<Conversation> = {},
	props: { deleting?: boolean } = {},
) {
	const onResolve = vi.fn();
	const onDelete = vi.fn();
	render(
		<DetailPanel
			conversation={conv(overrides)}
			onResolve={onResolve}
			onDelete={onDelete}
			resolving={false}
			deleting={props.deleting ?? false}
		/>,
	);
	return { onResolve, onDelete };
}

describe("DetailPanel", () => {
	it("renders only real captured fields (device parsed from the UA, real IP)", () => {
		setup();
		expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
		expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
		expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument(); // message count
	});

	it("falls back to a literal placeholder when device/IP are missing (never invents)", () => {
		setup({ userAgent: null, ipAddress: null });
		expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
	});

	it("renders the roadmap visitor-context as an honest empty block — em-dashes, never a value", () => {
		setup();
		expect(
			screen.getByText(/not captured yet — never show a guessed value/i),
		).toBeInTheDocument();
		expect(screen.getByText("Location")).toBeInTheDocument();
		expect(screen.getByText("Referrer")).toBeInTheDocument();
		// Every roadmap field renders an em-dash, not a fabricated value.
		expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(7);
	});

	it("shows the escalated block only when escalated", () => {
		setup({ escalatedAt: "2026-06-16T05:01:00.000Z" });
		expect(screen.getByText(/escalated to a human/i)).toBeInTheDocument();
	});

	it("shows the CSAT score honestly when rated", () => {
		setup({ csatRating: 4 });
		expect(screen.getByText(/4 \/ 5/)).toBeInTheDocument();
		expect(screen.queryByText(/not rated/i)).not.toBeInTheDocument();
	});

	it("Resolve fires directly", async () => {
		const user = userEvent.setup();
		const { onResolve } = setup();
		await user.click(screen.getByRole("button", { name: /^resolve$/i }));
		expect(onResolve).toHaveBeenCalledTimes(1);
	});

	it("offers Reopen (not Unarchive) for a resolved conversation", () => {
		setup({ archivedAt: "2026-06-16T05:02:00.000Z" });
		expect(screen.getByRole("button", { name: /reopen/i })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /unarchive/i })).toBeNull();
	});

	// Delete is a plain Button inside a controlled dialog (NOT AlertDialogAction):
	// the trigger opens the confirm; the confirm's plain Delete button fires.
	it("confirms before deleting, then the plain Delete button fires onDelete", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup();

		await user.click(
			screen.getByRole("button", { name: /delete conversation/i }),
		);
		expect(onDelete).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: /^delete$/i }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("shows 'Deleting…' while the delete is pending (dialog stays open)", async () => {
		const user = userEvent.setup();
		setup({}, { deleting: true });
		await user.click(
			screen.getByRole("button", { name: /delete conversation/i }),
		);
		expect(
			screen.getByRole("button", { name: /deleting/i }),
		).toBeInTheDocument();
	});
});
