import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "./top-bar";

// TopBar's layout is the unit under test; stub the data-driven shell pieces
// (they pull workspace/session context).
vi.mock("@/components/brand-logo", () => ({
	BrandLogo: () => <div data-testid="logo" />,
}));
vi.mock("@/components/shell/workspace-switcher", () => ({
	WorkspaceSwitcher: () => <div data-testid="ws" />,
}));
vi.mock("@/components/shell/project-switcher", () => ({
	ProjectSwitcher: () => <div data-testid="proj" />,
}));
vi.mock("@/components/shell/account-menu", () => ({
	AccountMenu: () => <div data-testid="acct" />,
}));

describe("TopBar — centered search trigger", () => {
	it("renders the wide centered search box with the ⌘K hint and the design placeholder", () => {
		render(
			<TopBar
				userEmail="a@b.c"
				roleLabel="Admin"
				onOpenSidebar={vi.fn()}
				onOpenSearch={vi.fn()}
			/>,
		);
		expect(
			screen.getByText(/search conversations & projects/i),
		).toBeInTheDocument();
		expect(screen.getByText("⌘K")).toBeInTheDocument();
	});

	it("opens the ⌘K palette when the search trigger is clicked (entry point intact)", async () => {
		const onOpenSearch = vi.fn();
		render(
			<TopBar
				userEmail="a@b.c"
				roleLabel="Admin"
				onOpenSidebar={vi.fn()}
				onOpenSearch={onOpenSearch}
			/>,
		);
		// Both the desktop box and the mobile icon are search triggers.
		const triggers = screen.getAllByRole("button", { name: /search/i });
		expect(triggers.length).toBeGreaterThanOrEqual(1);
		await userEvent.click(triggers[0]);
		expect(onOpenSearch).toHaveBeenCalled();
	});
});
