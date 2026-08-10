import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListFilters } from "./ListFilters";

function setup(props: Partial<React.ComponentProps<typeof ListFilters>> = {}) {
	const onSearch = vi.fn();
	const onStatusChange = vi.fn();
	const onAssigneeChange = vi.fn();
	const onTagIdsChange = vi.fn();
	const { unmount } = render(
		<ListFilters
			stats={props.stats}
			search=""
			onSearch={onSearch}
			status="open"
			onStatusChange={onStatusChange}
			assignee={props.assignee ?? "all"}
			onAssigneeChange={onAssigneeChange}
			tags={props.tags ?? []}
			tagIds={props.tagIds ?? []}
			onTagIdsChange={onTagIdsChange}
			onManageTags={props.onManageTags}
		/>,
	);
	return {
		onSearch,
		onStatusChange,
		onAssigneeChange,
		onTagIdsChange,
		unmount,
	};
}

/** The status/tag filters live in a popover (moved off the main rail) — open it
 * before asserting the controls inside. */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole("button", { name: /filters/i }));
}

const billing = { id: "t1", name: "Billing", color: "#6366f1", count: 3 };

describe("ListFilters", () => {
	it("renders the Inbox heading and the real conversation total (LIVE)", () => {
		setup({ stats: { total: 7, escalated: 1, resolved: 2, avgRating: 4 } });
		expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
		// The header subtitle is the real server total (not a placeholder).
		expect(screen.getByText(/7 conversations/i)).toBeInTheDocument();
	});

	it("reports the typed search query upward", async () => {
		const { onSearch } = setup();
		await userEvent.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");
	});

	it("offers the four LIVE status views and marks the active one", async () => {
		const user = userEvent.setup();
		setup({ tags: [] });
		await openFilters(user);
		const statusGroup = screen.getByRole("radiogroup", {
			name: /filter conversations by status/i,
		});
		for (const label of ["Open", "Resolved", "Escalated", "All"]) {
			expect(
				within(statusGroup).getByRole("radio", { name: label }),
			).toBeInTheDocument();
		}
		// Exactly the four real views are interactive radios — not the roadmap ones.
		expect(within(statusGroup).getAllByRole("radio")).toHaveLength(4);
	});

	it("reports the chosen status upward", async () => {
		const user = userEvent.setup();
		const { onStatusChange } = setup();
		await openFilters(user);
		await user.click(screen.getByRole("radio", { name: "Resolved" }));
		expect(onStatusChange).toHaveBeenCalledWith("resolved");
	});

	it("renders the remaining ROADMAP concept dimmed and non-interactive (never a filter)", async () => {
		const user = userEvent.setup();
		setup();
		await openFilters(user);
		expect(screen.getByText("AI-handled")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /ai-handled/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("radio", { name: /ai-handled/i }),
		).not.toBeInTheDocument();
	});

	it("offers the three LIVE assignee views (#96) and reports the choice upward", async () => {
		const user = userEvent.setup();
		const { onAssigneeChange } = setup();
		await openFilters(user);
		const group = screen.getByRole("radiogroup", {
			name: /filter conversations by assignee/i,
		});
		expect(within(group).getAllByRole("radio")).toHaveLength(3);
		await user.click(within(group).getByRole("radio", { name: /unassigned/i }));
		expect(onAssigneeChange).toHaveBeenCalledWith("none");
		await user.click(within(group).getByRole("radio", { name: /mine/i }));
		expect(onAssigneeChange).toHaveBeenCalledWith("me");
	});

	it("shows the real pill counts on Mine/Unassigned — and none on a stale response without them", async () => {
		const user = userEvent.setup();
		const { unmount } = setup({
			stats: {
				total: 7,
				escalated: 1,
				resolved: 2,
				avgRating: 4,
				mine: 3,
				unassigned: 2,
			},
		});
		await openFilters(user);
		const group = screen.getByRole("radiogroup", {
			name: /filter conversations by assignee/i,
		});
		// Mine carries ITS count and Unassigned ITS count (not swapped).
		expect(
			within(group).getByRole("radio", { name: /mine\s*3/i }),
		).toBeInTheDocument();
		expect(
			within(group).getByRole("radio", { name: /unassigned\s*2/i }),
		).toBeInTheDocument();
		unmount();
		// A cached pre-#96 stats response lacks the fields → no count, no filler.
		setup({ stats: { total: 7, escalated: 1, resolved: 2, avgRating: 4 } });
		await openFilters(user);
		const bare = screen.getByRole("radiogroup", {
			name: /filter conversations by assignee/i,
		});
		expect(
			within(bare).getByRole("radio", { name: /^mine$/i }),
		).toBeInTheDocument();
	});

	it("renders an 'All' chip plus a chip per real workspace tag (data-driven, not sample labels)", async () => {
		const user = userEvent.setup();
		setup({ tags: [billing] });
		await openFilters(user);
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Billing/ })).toBeInTheDocument();
	});

	it("toggles a tag id upward when its chip is clicked", async () => {
		const user = userEvent.setup();
		const { onTagIdsChange } = setup({ tags: [billing] });
		await openFilters(user);
		await user.click(screen.getByRole("button", { name: /Billing/ }));
		expect(onTagIdsChange).toHaveBeenCalledWith(["t1"]);
	});

	it("clears the tag filter when 'All' is clicked", async () => {
		const user = userEvent.setup();
		const { onTagIdsChange } = setup({ tags: [billing], tagIds: ["t1"] });
		await openFilters(user);
		await user.click(screen.getByRole("button", { name: "All" }));
		expect(onTagIdsChange).toHaveBeenCalledWith([]);
	});

	it("shows the Manage affordance only when onManageTags is provided (admin/owner)", async () => {
		const user = userEvent.setup();
		const { unmount } = setup({ tags: [billing] });
		await openFilters(user);
		expect(
			screen.queryByRole("button", { name: /manage/i }),
		).not.toBeInTheDocument();
		unmount();
		const onManageTags = vi.fn();
		setup({ tags: [billing], onManageTags });
		await openFilters(user);
		expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
	});
});
