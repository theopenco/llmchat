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
		...overrides,
	};
}

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

function setup(overrides: Partial<Conversation> = {}) {
	const onArchive = vi.fn();
	const onDelete = vi.fn();
	render(
		<DetailPanel
			conversation={conv(overrides)}
			onArchive={onArchive}
			onDelete={onDelete}
			archiving={false}
			deleting={false}
		/>,
	);
	return { onArchive, onDelete };
}

describe("DetailPanel", () => {
	it("renders contact, session, and a friendly device string from the user agent", () => {
		setup();
		// Email shows in both the header and the contact field.
		expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
		expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
		expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument(); // message count
	});

	it("falls back to Unknown when device/IP data is missing (never invents)", () => {
		setup({ userAgent: null, ipAddress: null });
		// Device and IP both read "Unknown".
		expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
	});

	it("shows the escalated block only when escalated", () => {
		setup({ escalatedAt: "2026-06-16T05:01:00.000Z" });
		expect(screen.getByText(/escalated to a human/i)).toBeInTheDocument();
	});

	it("renders ratings as a disabled placeholder, not a number", () => {
		setup();
		expect(screen.getByText(/not collected yet/i)).toBeInTheDocument();
	});

	it("archives directly but confirms before deleting", async () => {
		const user = userEvent.setup();
		const { onArchive, onDelete } = setup();

		await user.click(screen.getByRole("button", { name: /^archive$/i }));
		expect(onArchive).toHaveBeenCalledTimes(1);

		// Delete is guarded by a confirm dialog — the trigger alone doesn't delete.
		await user.click(
			screen.getByRole("button", { name: /delete conversation/i }),
		);
		expect(onDelete).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: /^delete$/i }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("offers Unarchive for an archived conversation", () => {
		setup({ archivedAt: "2026-06-16T05:02:00.000Z" });
		expect(
			screen.getByRole("button", { name: /unarchive/i }),
		).toBeInTheDocument();
	});
});
