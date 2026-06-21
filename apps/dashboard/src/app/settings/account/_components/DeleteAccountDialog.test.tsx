import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DeleteAccountDialog } from "./DeleteAccountDialog";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

function setup(
	props: Partial<React.ComponentProps<typeof DeleteAccountDialog>> = {},
) {
	const onConfirm = vi.fn();
	const onOpenChange = vi.fn();
	const utils = render(
		<DeleteAccountDialog
			open
			onOpenChange={onOpenChange}
			email="ada@example.io"
			requirePassword={false}
			pending={false}
			onConfirm={onConfirm}
			{...props}
		/>,
	);
	return { onConfirm, onOpenChange, ...utils };
}

const confirmBtn = () =>
	screen.getByRole("button", { name: /delete account/i });

describe("DeleteAccountDialog", () => {
	it("arms only on a case-insensitive email match, then confirms with the trimmed email", async () => {
		const user = userEvent.setup();
		const { onConfirm } = setup();
		expect(confirmBtn()).toBeDisabled();
		await user.type(
			screen.getByLabelText("Confirm email"),
			"  ADA@EXAMPLE.IO  ",
		);
		expect(confirmBtn()).toBeEnabled();
		await user.click(confirmBtn());
		expect(onConfirm).toHaveBeenCalledWith({
			confirmEmail: "ADA@EXAMPLE.IO",
			password: undefined,
		});
	});

	it("requires a password when requirePassword and includes it on confirm", async () => {
		const user = userEvent.setup();
		const { onConfirm } = setup({ requirePassword: true });
		await user.type(screen.getByLabelText("Confirm email"), "ada@example.io");
		expect(confirmBtn()).toBeDisabled(); // password still empty
		await user.type(screen.getByLabelText("Password"), "pw");
		await user.click(confirmBtn());
		expect(onConfirm).toHaveBeenCalledWith({
			confirmEmail: "ada@example.io",
			password: "pw",
		});
	});

	it("resets the typed fields when the dialog closes (no pre-armed reopen)", async () => {
		const user = userEvent.setup();
		const { onOpenChange, rerender } = setup();
		await user.type(screen.getByLabelText("Confirm email"), "ada@example.io");
		expect(confirmBtn()).toBeEnabled();
		// Cancel → onOpenChange(false) fires; the dialog clears its state.
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
		// Reopen → the field is empty again and confirm is disabled.
		rerender(
			<DeleteAccountDialog
				open
				onOpenChange={onOpenChange}
				email="ada@example.io"
				requirePassword={false}
				pending={false}
				onConfirm={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText("Confirm email")).toHaveValue("");
		expect(confirmBtn()).toBeDisabled();
	});
});
