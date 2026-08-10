import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { ThreadActions } from "./ThreadActions";

function setup(
	props: {
		resolved?: boolean;
		deleting?: boolean;
		assignControl?: ReactNode;
	} = {},
) {
	const onResolve = vi.fn();
	const onDelete = vi.fn();
	render(
		<ThreadActions
			resolved={props.resolved ?? false}
			onResolve={onResolve}
			onDelete={onDelete}
			resolving={false}
			deleting={props.deleting ?? false}
			assignControl={props.assignControl}
		/>,
	);
	return { onResolve, onDelete };
}

describe("ThreadActions", () => {
	it("Resolve fires directly", async () => {
		const { onResolve } = setup();
		await userEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
		expect(onResolve).toHaveBeenCalledTimes(1);
	});

	it("offers Reopen (not Unarchive) for a resolved conversation", () => {
		setup({ resolved: true });
		expect(screen.getByRole("button", { name: /reopen/i })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /unarchive/i }),
		).not.toBeInTheDocument();
	});

	// Delete is a plain Button inside a controlled dialog (NOT AlertDialogAction):
	// the header trigger opens the confirm; the confirm's plain Delete fires.
	it("confirms before deleting, then the dialog's Delete fires onDelete", async () => {
		const user = userEvent.setup();
		const { onDelete } = setup();

		// Only the trigger exists before the dialog opens.
		await user.click(screen.getByRole("button", { name: /^delete$/i }));
		expect(onDelete).not.toHaveBeenCalled();

		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("shows 'Deleting…' while the delete is pending (dialog stays open)", async () => {
		const user = userEvent.setup();
		setup({ deleting: true });
		await user.click(screen.getByRole("button", { name: /^delete$/i }));
		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByRole("button", { name: /deleting/i }),
		).toBeInTheDocument();
	});

	it("renders the assignControl slot verbatim (#96 — the stub graduated to AssigneePicker)", () => {
		setup({ assignControl: <button type="button">Assign</button> });
		expect(
			screen.getByRole("button", { name: /^assign$/i }),
		).toBeInTheDocument();
	});
});
