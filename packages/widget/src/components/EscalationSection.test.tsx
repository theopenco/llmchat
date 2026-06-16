import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EscalationSection } from "./EscalationSection";

describe("EscalationSection", () => {
	it("shows the failure message only when failed", () => {
		const { rerender } = render(
			<EscalationSection
				pending={false}
				failed={false}
				onEscalate={() => {}}
			/>,
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();

		rerender(
			<EscalationSection pending={false} failed onEscalate={() => {}} />,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			/couldn't reach the team/i,
		);
	});

	it("disables the button while pending so it cannot be double-fired", async () => {
		const onEscalate = vi.fn();
		render(
			<EscalationSection pending failed={false} onEscalate={onEscalate} />,
		);

		const button = screen.getByRole("button", { name: /sending/i });
		expect(button).toBeDisabled();
		await userEvent.click(button).catch(() => {});
		expect(onEscalate).not.toHaveBeenCalled();
	});

	it("fires the callback when idle", async () => {
		const onEscalate = vi.fn();
		render(
			<EscalationSection
				pending={false}
				failed={false}
				onEscalate={onEscalate}
			/>,
		);
		await userEvent.click(
			screen.getByRole("button", { name: /talk to a human/i }),
		);
		expect(onEscalate).toHaveBeenCalledOnce();
	});
});
