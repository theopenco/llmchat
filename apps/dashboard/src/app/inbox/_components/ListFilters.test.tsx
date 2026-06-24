import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListFilters } from "./ListFilters";

function setup(props: Partial<React.ComponentProps<typeof ListFilters>> = {}) {
	const onSearch = vi.fn();
	const onStatusChange = vi.fn();
	const onTagIdsChange = vi.fn();
	const { unmount } = render(
		<ListFilters
			stats={props.stats}
			search=""
			onSearch={onSearch}
			status="open"
			onStatusChange={onStatusChange}
			tags={props.tags ?? []}
			tagIds={props.tagIds ?? []}
			onTagIdsChange={onTagIdsChange}
			onManageTags={props.onManageTags}
		/>,
	);
	return { onSearch, onStatusChange, onTagIdsChange, unmount };
}

const billing = { id: "t1", name: "Billing", color: "#6366f1", count: 3 };

describe("ListFilters", () => {
	it("renders the Inbox heading and the real stat aggregates (LIVE)", () => {
		setup({ stats: { total: 7, escalated: 1, resolved: 2, avgRating: 4 } });
		expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
		// "Conversations" is the stats-card label (unique to the restored panel);
		// its value is the real total.
		expect(screen.getByText("Conversations")).toBeInTheDocument();
		expect(screen.getByText("7")).toBeInTheDocument();
	});

	it("reports the typed search query upward", async () => {
		const { onSearch } = setup();
		await userEvent.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");
	});

	it("offers the four LIVE status views and marks the active one", () => {
		setup({ tags: [] });
		for (const label of ["Open", "Resolved", "Escalated", "All"]) {
			expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
		}
		// Exactly the four real views are interactive radios — not the roadmap ones.
		expect(screen.getAllByRole("radio")).toHaveLength(4);
	});

	it("reports the chosen status upward", async () => {
		const { onStatusChange } = setup();
		await userEvent.click(screen.getByRole("radio", { name: "Resolved" }));
		expect(onStatusChange).toHaveBeenCalledWith("resolved");
	});

	it("renders the ROADMAP status concepts as dimmed, non-interactive labels (never a filter)", () => {
		setup();
		// Present for layout parity…
		expect(screen.getByText("Unassigned")).toBeInTheDocument();
		expect(screen.getByText("AI-handled")).toBeInTheDocument();
		// …but NOT real controls — they are not radios/buttons, so they can't filter.
		expect(
			screen.queryByRole("radio", { name: /unassigned/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /ai-handled/i }),
		).not.toBeInTheDocument();
	});

	it("renders an 'All' chip plus a chip per real workspace tag (data-driven, not sample labels)", () => {
		setup({ tags: [billing] });
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Billing/ })).toBeInTheDocument();
	});

	it("toggles a tag id upward when its chip is clicked", async () => {
		const { onTagIdsChange } = setup({ tags: [billing] });
		await userEvent.click(screen.getByRole("button", { name: /Billing/ }));
		expect(onTagIdsChange).toHaveBeenCalledWith(["t1"]);
	});

	it("clears the tag filter when 'All' is clicked", async () => {
		const { onTagIdsChange } = setup({ tags: [billing], tagIds: ["t1"] });
		await userEvent.click(screen.getByRole("button", { name: "All" }));
		expect(onTagIdsChange).toHaveBeenCalledWith([]);
	});

	it("shows the Manage affordance only when onManageTags is provided (admin/owner)", () => {
		const { unmount } = setup({ tags: [billing] });
		expect(
			screen.queryByRole("button", { name: /manage/i }),
		).not.toBeInTheDocument();
		unmount();
		const onManageTags = vi.fn();
		setup({ tags: [billing], onManageTags });
		expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
	});
});
