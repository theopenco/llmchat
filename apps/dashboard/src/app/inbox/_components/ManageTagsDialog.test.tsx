import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ManageTagsDialog } from "./ManageTagsDialog";
import type { Tag } from "./types";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

const TAGS: Tag[] = [
	{ id: "t1", name: "Billing", color: "#6366f1", count: 12 },
	{ id: "t2", name: "Bug", color: "#ef4444", count: 0 },
];

function setup(
	props: Partial<React.ComponentProps<typeof ManageTagsDialog>> = {},
) {
	const onRename = vi.fn();
	const onRecolor = vi.fn();
	const onDelete = vi.fn();
	render(
		<ManageTagsDialog
			open
			onOpenChange={vi.fn()}
			tags={TAGS}
			onRename={onRename}
			onRecolor={onRecolor}
			onDelete={onDelete}
			{...props}
		/>,
	);
	return { onRename, onRecolor, onDelete };
}

describe("ManageTagsDialog", () => {
	it("lists each tag with its conversation count", () => {
		setup();
		expect(screen.getByText("Billing")).toBeInTheDocument();
		expect(screen.getByText("12 conversations")).toBeInTheDocument();
		expect(screen.getByText("0 conversations")).toBeInTheDocument();
	});

	it("renames a tag inline (Enter commits the new name)", async () => {
		const user = userEvent.setup();
		const { onRename } = setup();
		await user.click(screen.getByRole("button", { name: "Edit Billing" }));
		const input = screen.getByRole("textbox", { name: "Rename Billing" });
		await user.clear(input);
		await user.type(input, "Payments{Enter}");
		expect(onRename).toHaveBeenCalledWith(TAGS[0], "Payments");
	});

	it("does not call onRename when the name is unchanged", async () => {
		const user = userEvent.setup();
		const { onRename } = setup();
		await user.click(screen.getByRole("button", { name: "Edit Billing" }));
		await user.type(
			screen.getByRole("textbox", { name: "Rename Billing" }),
			"{Enter}",
		);
		expect(onRename).not.toHaveBeenCalled();
	});

	it("recolors a tag from the palette (reports a palette hex)", async () => {
		const user = userEvent.setup();
		const { onRecolor } = setup();
		await user.click(screen.getByRole("button", { name: "Recolor Billing" }));
		await user.click(screen.getByRole("button", { name: "Set color #10b981" }));
		expect(onRecolor).toHaveBeenCalledWith(TAGS[0], "#10b981");
	});

	it("delete confirm states the impact with the real count, then calls onDelete", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup();
		await user.click(screen.getByRole("button", { name: "Delete Billing" }));
		// The confirm names the tag and the conversation count.
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getByText(/Delete “Billing”\?/)).toBeInTheDocument();
		expect(
			within(dialog).getByText(/removed from 12 conversations/),
		).toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(onDelete).toHaveBeenCalledWith(TAGS[0]);
	});

	it("for a tag on no conversations, the confirm says so (no '0 conversations' impact)", async () => {
		const user = userEvent.setup();
		setup();
		await user.click(screen.getByRole("button", { name: "Delete Bug" }));
		const dialog = screen.getByRole("alertdialog");
		expect(
			within(dialog).getByText(/isn't on any conversations/),
		).toBeInTheDocument();
	});

	it("shows an empty state when there are no tags", () => {
		setup({ tags: [] });
		expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
	});
});
