import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Composer } from "./Composer";

function setup(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
	const onSubmit = vi.fn();
	const onChange = vi.fn();
	render(
		<Composer
			value={props.value ?? ""}
			disabled={props.disabled ?? false}
			onChange={props.onChange ?? onChange}
			onSubmit={props.onSubmit ?? onSubmit}
		/>,
	);
	return { onSubmit, onChange };
}

describe("Composer", () => {
	it("does not submit whitespace-only input", async () => {
		const { onSubmit } = setup({ value: "   " });
		await userEvent.keyboard("{Enter}");
		expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("does not submit while sending is in flight (no double-send)", async () => {
		const { onSubmit } = setup({ value: "hello", disabled: true });
		const textarea = screen.getByPlaceholderText(/type a message/i);
		await userEvent.type(textarea, "{Enter}");
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
	});

	it("submits on Enter but not Shift+Enter", async () => {
		const { onSubmit } = setup({ value: "hello" });
		const textarea = screen.getByPlaceholderText(/type a message/i);
		await userEvent.type(textarea, "{Shift>}{Enter}{/Shift}");
		expect(onSubmit).not.toHaveBeenCalled();
		await userEvent.type(textarea, "{Enter}");
		expect(onSubmit).toHaveBeenCalledOnce();
	});
});
