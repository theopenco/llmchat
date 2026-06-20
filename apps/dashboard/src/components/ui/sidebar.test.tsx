import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, SidebarTrigger, useSidebar } from "./sidebar";

// The drawer-vs-docked decision is driven by the viewport hook; mock it so each
// test can pin "mobile" or "desktop" deterministically (jsdom has no layout).
const isMobile = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => isMobile(),
}));

afterEach(() => {
	isMobile.mockReset();
});

/** Surfaces the sidebar context so tests can assert open/close state directly,
 * without depending on the Radix Sheet portal rendering. */
function Probe() {
	const { isMobile: mobile, open, openMobile, state } = useSidebar();
	return (
		<div>
			<span data-testid="state">{state}</span>
			<span data-testid="open">{String(open)}</span>
			<span data-testid="openMobile">{String(openMobile)}</span>
			<span data-testid="isMobile">{String(mobile)}</span>
		</div>
	);
}

function setup() {
	return render(
		<SidebarProvider>
			<SidebarTrigger />
			<Probe />
		</SidebarProvider>,
	);
}

describe("Sidebar drawer open/close", () => {
	it("on mobile: the trigger opens then closes the drawer (openMobile), leaving the docked state untouched", async () => {
		isMobile.mockReturnValue(true);
		const user = userEvent.setup();
		setup();

		// Drawer starts closed — no yank-open on mount.
		expect(screen.getByTestId("isMobile")).toHaveTextContent("true");
		expect(screen.getByTestId("openMobile")).toHaveTextContent("false");

		await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		expect(screen.getByTestId("openMobile")).toHaveTextContent("true");

		await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		expect(screen.getByTestId("openMobile")).toHaveTextContent("false");

		// The desktop docked state is never touched by the mobile drawer toggle.
		expect(screen.getByTestId("open")).toHaveTextContent("true");
		expect(screen.getByTestId("state")).toHaveTextContent("expanded");
	});

	it("on desktop: the trigger collapses then expands the docked sidebar (not the drawer)", async () => {
		isMobile.mockReturnValue(false);
		const user = userEvent.setup();
		setup();

		expect(screen.getByTestId("isMobile")).toHaveTextContent("false");
		expect(screen.getByTestId("state")).toHaveTextContent("expanded");

		await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		expect(screen.getByTestId("open")).toHaveTextContent("false");
		expect(screen.getByTestId("state")).toHaveTextContent("collapsed");

		await user.click(screen.getByRole("button", { name: /toggle sidebar/i }));
		expect(screen.getByTestId("state")).toHaveTextContent("expanded");

		// The mobile drawer stays closed throughout a desktop toggle.
		expect(screen.getByTestId("openMobile")).toHaveTextContent("false");
	});
});
