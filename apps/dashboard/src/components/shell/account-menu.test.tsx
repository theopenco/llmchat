import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSignOut } from "@/lib/use-sign-out";

import { AccountMenu } from "./account-menu";

const signOut = vi.fn();
vi.mock("@/lib/use-sign-out", () => ({ useSignOut: vi.fn() }));
vi.mock("@/lib/account", () => ({
	ACCOUNT_KEY: ["account"],
	fetchAccount: vi.fn(),
}));

function renderMenu() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(AccountMenu, {
				userEmail: "a@b.com",
				roleLabel: "Owner",
			}),
		) as ReactNode,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useSignOut).mockReturnValue(signOut);
});

describe("AccountMenu", () => {
	it("opens to Account / Billing / Sign out and NO Settings or Appearance entry", async () => {
		const user = userEvent.setup();
		renderMenu();
		await user.click(screen.getByRole("button", { name: /account menu/i }));

		expect(
			await screen.findByRole("menuitem", { name: /account/i }),
		).toHaveAttribute("href", "/settings/account");
		expect(screen.getByRole("menuitem", { name: /billing/i })).toHaveAttribute(
			"href",
			"/settings/billing",
		);
		expect(
			screen.getByRole("menuitem", { name: /sign out/i }),
		).toBeInTheDocument();
		// Light-only now (Chatbase-style): no appearance switcher.
		expect(screen.queryByRole("menuitem", { name: /^light$/i })).toBeNull();
		expect(screen.queryByRole("menuitem", { name: /^system$/i })).toBeNull();
		// No dead "Settings" / workspace-management duplicate here.
		expect(screen.queryByRole("menuitem", { name: /^settings$/i })).toBeNull();
		expect(
			screen.queryByRole("menuitem", { name: /manage workspaces/i }),
		).toBeNull();
	});

	it("signs out", async () => {
		const user = userEvent.setup();
		renderMenu();
		await user.click(screen.getByRole("button", { name: /account menu/i }));
		await user.click(
			await screen.findByRole("menuitem", { name: /sign out/i }),
		);
		expect(signOut).toHaveBeenCalled();
	});
});
