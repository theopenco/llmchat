import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DetailPanel } from "./DetailPanel";

import type { Conversation, Tag } from "./types";

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
	props: { tags?: Tag[]; attachedTags?: Tag[] } = {},
) {
	const onToggleTag = vi.fn();
	const onCreateTag = vi.fn();
	const onRemoveTag = vi.fn();
	render(
		<DetailPanel
			conversation={conv(overrides)}
			tags={props.tags ?? []}
			attachedTags={props.attachedTags ?? []}
			onToggleTag={onToggleTag}
			onCreateTag={onCreateTag}
			onRemoveTag={onRemoveTag}
			creatingTag={false}
		/>,
	);
	return { onToggleTag, onCreateTag, onRemoveTag };
}

describe("DetailPanel", () => {
	it("renders only real captured fields (device parsed from the UA, real IP)", () => {
		setup();
		expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
		expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
		expect(screen.getByText("203.0.113.7")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument(); // message count
	});

	it("offers a Copy email action when an email is present", () => {
		setup();
		expect(
			screen.getByRole("button", { name: /copy email/i }),
		).toBeInTheDocument();
	});

	it("falls back to a literal placeholder when device/IP are missing (never invents)", () => {
		setup({ userAgent: null, ipAddress: null });
		expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(2);
	});

	it("renders the roadmap visitor-context as an honest empty block — em-dashes, never a value", () => {
		setup();
		expect(screen.getByText(/not captured yet/i)).toBeInTheDocument();
		expect(screen.getByText("Location")).toBeInTheDocument();
		expect(screen.getByText("Referrer")).toBeInTheDocument();
		// Every roadmap field renders an em-dash, not a fabricated value.
		expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(7);
	});

	it("shows the escalated block only when escalated", () => {
		setup({ escalatedAt: "2026-06-16T05:01:00.000Z" });
		expect(screen.getByText(/escalated to a human/i)).toBeInTheDocument();
	});

	it("shows the resolved banner with the actor when resolved (Bug 4 attribution)", () => {
		setup({ archivedAt: "2026-06-16T05:02:00.000Z", resolvedBy: "visitor" });
		expect(screen.getByText(/resolved by the visitor/i)).toBeInTheDocument();
	});

	it("attributes an admin resolve to the team", () => {
		setup({ archivedAt: "2026-06-16T05:02:00.000Z", resolvedBy: "admin" });
		expect(screen.getByText(/resolved by your team/i)).toBeInTheDocument();
	});

	it("falls back to a plain 'Resolved' when the actor is null (legacy rows — never a guessed actor)", () => {
		setup({ archivedAt: "2026-06-16T05:02:00.000Z", resolvedBy: null });
		expect(screen.getByText(/^resolved$/i)).toBeInTheDocument();
		expect(screen.queryByText(/resolved by/i)).not.toBeInTheDocument();
	});

	it("shows no resolved banner when not resolved", () => {
		setup({ archivedAt: null });
		expect(screen.queryByText(/^resolved/i)).not.toBeInTheDocument();
	});

	it("shows the CSAT score honestly when rated", () => {
		setup({ csatRating: 4 });
		expect(screen.getByText(/4 \/ 5/)).toBeInTheDocument();
		expect(screen.queryByText(/not rated/i)).not.toBeInTheDocument();
	});

	it("renders attached tags with a remove control and reports removal upward", async () => {
		const tag: Tag = { id: "t1", name: "orders", color: "#6366f1" };
		const { onRemoveTag } = setup({}, { tags: [tag], attachedTags: [tag] });
		expect(screen.getByText("orders")).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: /remove tag orders/i }),
		);
		expect(onRemoveTag).toHaveBeenCalledWith("t1");
	});

	it("no longer renders Resolve/Delete — those live in the thread header now", () => {
		setup();
		expect(screen.queryByRole("button", { name: /^resolve$/i })).toBeNull();
		expect(
			screen.queryByRole("button", { name: /delete conversation/i }),
		).toBeNull();
	});
});
