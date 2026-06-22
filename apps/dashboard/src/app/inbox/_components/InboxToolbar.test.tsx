import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { InboxToolbar } from "./InboxToolbar";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

function setup(props: Partial<React.ComponentProps<typeof InboxToolbar>> = {}) {
	const onSearch = vi.fn();
	const onStatusChange = vi.fn();
	const onTagIdsChange = vi.fn();
	const { unmount } = render(
		<InboxToolbar
			search=""
			onSearch={onSearch}
			status="open"
			onStatusChange={onStatusChange}
			tags={[]}
			tagIds={[]}
			onTagIdsChange={onTagIdsChange}
			{...props}
		/>,
	);
	return { onSearch, onStatusChange, onTagIdsChange, unmount };
}

describe("InboxToolbar", () => {
	it("reports the typed search query upward", async () => {
		const user = userEvent.setup();
		const { onSearch } = setup();
		await user.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");
	});

	it("offers the four derived status views and marks the active one", () => {
		setup({ status: "escalated" });
		for (const label of ["Open", "Resolved", "Escalated", "All"]) {
			expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
		}
		expect(screen.getByRole("radio", { name: "Escalated" })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("reports the chosen status upward", async () => {
		const user = userEvent.setup();
		const { onStatusChange } = setup();
		await user.click(screen.getByRole("radio", { name: "Resolved" }));
		expect(onStatusChange).toHaveBeenCalledWith("resolved");
	});

	it("disables the Tags filter when the workspace has no tags", () => {
		setup({ tags: [] });
		expect(screen.getByRole("button", { name: /tags/i })).toBeDisabled();
	});

	it("opens the tag filter and reports a toggled tag id upward", async () => {
		const user = userEvent.setup();
		const { onTagIdsChange } = setup({
			tags: [{ id: "t1", name: "Billing", color: "#6366f1", count: 3 }],
		});
		const btn = screen.getByRole("button", { name: /tags/i });
		expect(btn).not.toBeDisabled();
		await user.click(btn);
		await user.click(screen.getByRole("option", { name: /Billing/ }));
		expect(onTagIdsChange).toHaveBeenCalledWith(["t1"]);
	});

	it("shows the 'Manage tags' link only when onManageTags is provided (admin/owner)", async () => {
		const user = userEvent.setup();
		const tags = [{ id: "t1", name: "Billing", color: "#6366f1", count: 3 }];

		const { unmount } = setup({ tags });
		await user.click(screen.getByRole("button", { name: /tags/i }));
		expect(
			screen.queryByRole("button", { name: /manage tags/i }),
		).not.toBeInTheDocument();
		unmount();

		const onManageTags = vi.fn();
		setup({ tags, onManageTags });
		await user.click(screen.getByRole("button", { name: /tags/i }));
		await user.click(screen.getByRole("button", { name: /manage tags/i }));
		expect(onManageTags).toHaveBeenCalled();
	});
});
