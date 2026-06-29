import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EscalationNotice } from "./EscalationNotice";

describe("EscalationNotice", () => {
	it("always shows the reassurance notice", () => {
		render(<EscalationNotice summary={null} />);
		expect(
			screen.getByText(/human operator has been notified/i),
		).toBeInTheDocument();
	});

	it("renders the summary card ONLY when a summary is present (honesty rail)", () => {
		const { rerender } = render(<EscalationNotice summary={null} />);
		expect(screen.queryByText("Summary")).not.toBeInTheDocument();

		rerender(<EscalationNotice summary="You asked about your late order." />);
		expect(screen.getByText("Summary")).toBeInTheDocument();
		expect(
			screen.getByText("You asked about your late order."),
		).toBeInTheDocument();
	});

	it("renders the recap as plain text, never markup (XSS-safe)", () => {
		render(
			<EscalationNotice
				summary={"<img src=x onerror=alert(1)> **not bold**"}
			/>,
		);
		expect(
			screen.getByText("<img src=x onerror=alert(1)> **not bold**"),
		).toBeInTheDocument();
		// React escaped it — no real <img> element was injected.
		expect(document.querySelector("img")).toBeNull();
	});
});
