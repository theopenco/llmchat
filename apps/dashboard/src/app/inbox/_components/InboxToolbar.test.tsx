import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { InboxToolbar } from "./InboxToolbar";

beforeAll(() => {
	// Radix Select uses pointer-capture + scrollIntoView, unimplemented in jsdom.
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

function setup(props: Partial<React.ComponentProps<typeof InboxToolbar>> = {}) {
	const onSearch = vi.fn();
	const onShowArchivedChange = vi.fn();
	const onTagIdsChange = vi.fn();
	render(
		<InboxToolbar
			search=""
			onSearch={onSearch}
			showArchived={false}
			onShowArchivedChange={onShowArchivedChange}
			tags={[]}
			tagIds={[]}
			onTagIdsChange={onTagIdsChange}
			{...props}
		/>,
	);
	return { onSearch, onShowArchivedChange, onTagIdsChange };
}

describe("InboxToolbar", () => {
	it("reports the typed search query upward", async () => {
		const user = userEvent.setup();
		const { onSearch } = setup();
		await user.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");
	});

	it("reflects the active status in the filter control", () => {
		const base = {
			search: "",
			onSearch: vi.fn(),
			onShowArchivedChange: vi.fn(),
			tags: [],
			tagIds: [],
			onTagIdsChange: vi.fn(),
		};
		const { rerender } = render(
			<InboxToolbar {...base} showArchived={false} />,
		);
		expect(screen.getByText("All conversations")).toBeInTheDocument();

		rerender(<InboxToolbar {...base} showArchived />);
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("switches to the archived view from the filter dropdown", async () => {
		const user = userEvent.setup();
		const { onShowArchivedChange } = setup();
		await user.click(screen.getByRole("combobox", { name: /filter/i }));
		await user.click(screen.getByRole("option", { name: "Archived" }));
		expect(onShowArchivedChange).toHaveBeenCalledWith(true);
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
});
