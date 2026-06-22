import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteProjectDialog } from "./DeleteProjectDialog";

describe("DeleteProjectDialog", () => {
	// Plain Button (not AlertDialogAction): the confirm fires the handler, and the
	// parent's mutation is non-optimistic so the dialog stays open until success.
	it("fires onConfirm from the plain Delete button", async () => {
		const onConfirm = vi.fn();
		render(
			<DeleteProjectDialog
				open
				onOpenChange={vi.fn()}
				onConfirm={onConfirm}
				pending={false}
			/>,
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /^delete$/i }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("shows 'Deleting…' and disables confirm while pending (dialog stays open)", () => {
		render(
			<DeleteProjectDialog
				open
				onOpenChange={vi.fn()}
				onConfirm={vi.fn()}
				pending
			/>,
		);
		const btn = screen.getByRole("button", { name: /deleting/i });
		expect(btn).toBeInTheDocument();
		expect(btn).toBeDisabled();
	});
});
