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
	render(
		<InboxToolbar
			search=""
			onSearch={onSearch}
			showArchived={false}
			onShowArchivedChange={onShowArchivedChange}
			{...props}
		/>,
	);
	return { onSearch, onShowArchivedChange };
}

describe("InboxToolbar", () => {
	it("reports the typed search query upward", async () => {
		const user = userEvent.setup();
		const { onSearch } = setup();
		await user.type(screen.getByLabelText("Search conversations"), "x");
		expect(onSearch).toHaveBeenCalledWith("x");
	});

	it("reflects the active status in the filter control", () => {
		const { rerender } = render(
			<InboxToolbar
				search=""
				onSearch={vi.fn()}
				showArchived={false}
				onShowArchivedChange={vi.fn()}
			/>,
		);
		expect(screen.getByText("All conversations")).toBeInTheDocument();

		rerender(
			<InboxToolbar
				search=""
				onSearch={vi.fn()}
				showArchived
				onShowArchivedChange={vi.fn()}
			/>,
		);
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});

	it("switches to the archived view from the filter dropdown", async () => {
		const user = userEvent.setup();
		const { onShowArchivedChange } = setup();
		await user.click(screen.getByRole("combobox", { name: /filter/i }));
		await user.click(screen.getByRole("option", { name: "Archived" }));
		expect(onShowArchivedChange).toHaveBeenCalledWith(true);
	});

	it("marks the not-yet-available Filters control as disabled", () => {
		setup();
		expect(screen.getByRole("button", { name: /filters/i })).toBeDisabled();
	});
});
