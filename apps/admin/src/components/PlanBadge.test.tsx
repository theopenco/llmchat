import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlanBadge } from "./PlanBadge";

describe("PlanBadge", () => {
	it("renders the plan name", () => {
		render(<PlanBadge plan="growth" />);
		expect(screen.getByText("growth")).toBeInTheDocument();
	});

	it("styles the unpaid `none` plan as muted", () => {
		render(<PlanBadge plan="none" />);
		expect(screen.getByText("none").className).toContain("text-faint");
	});
});
