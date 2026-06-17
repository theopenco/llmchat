import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CsatStep } from "./CsatStep";

describe("CsatStep", () => {
	it("renders the prompt with five star buttons", () => {
		render(<CsatStep step="prompt" onRate={vi.fn()} onSkip={vi.fn()} />);
		expect(screen.getByText(/how was your experience/i)).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: /star/i })).toHaveLength(5);
		expect(
			screen.getByRole("button", { name: /^3 stars$/i }),
		).toBeInTheDocument();
	});

	it("submits the tapped star value", async () => {
		const onRate = vi.fn();
		render(<CsatStep step="prompt" onRate={onRate} onSkip={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /^4 stars$/i }));
		expect(onRate).toHaveBeenCalledWith(4);
	});

	it("skips without rating", async () => {
		const onRate = vi.fn();
		const onSkip = vi.fn();
		render(<CsatStep step="prompt" onRate={onRate} onSkip={onSkip} />);
		await userEvent.click(screen.getByRole("button", { name: /skip/i }));
		expect(onSkip).toHaveBeenCalledTimes(1);
		expect(onRate).not.toHaveBeenCalled();
	});

	it("shows a thank-you on the thanks step (no stars)", () => {
		render(<CsatStep step="thanks" onRate={vi.fn()} onSkip={vi.fn()} />);
		expect(screen.getByText(/thanks for your feedback/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /star/i }),
		).not.toBeInTheDocument();
	});
});
