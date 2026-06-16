import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnboardingNameStep } from "./OnboardingNameStep";

describe("OnboardingNameStep", () => {
	it("disables submit until a non-blank name is entered", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<OnboardingNameStep onSubmit={onSubmit} pending={false} />);

		const button = screen.getByRole("button", { name: /create chatbot/i });
		expect(button).toBeDisabled();

		// Whitespace alone doesn't enable it.
		await user.type(screen.getByLabelText(/business or chatbot name/i), "   ");
		expect(button).toBeDisabled();
	});

	it("submits the trimmed name", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<OnboardingNameStep onSubmit={onSubmit} pending={false} />);

		await user.type(
			screen.getByLabelText(/business or chatbot name/i),
			"  Acme Tools  ",
		);
		await user.click(screen.getByRole("button", { name: /create chatbot/i }));

		expect(onSubmit).toHaveBeenCalledWith("Acme Tools");
	});

	it("does not submit while pending", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<OnboardingNameStep onSubmit={onSubmit} pending />);

		await user.type(screen.getByLabelText(/business or chatbot name/i), "Acme");
		expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
