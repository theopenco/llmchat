import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { planEntitlements } from "@llmchat/shared";

import {
	fetchUsage,
	isBillingNotConfigured,
	openPortal,
	startCheckout,
} from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";
import type { Plan } from "@/lib/workspace-utils";

import BillingPage from "./page";

const useSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
	useSearchParams: () => useSearchParams(),
}));
vi.mock("@/lib/workspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/lib/billing", () => ({
	startCheckout: vi.fn(),
	openPortal: vi.fn(),
	fetchUsage: vi.fn(),
	isBillingNotConfigured: vi.fn(() => false),
}));

function setWorkspace(plan: Plan | null, role: "owner" | "agent" = "owner") {
	vi.mocked(useWorkspace).mockReturnValue({
		workspaces: plan ? [{ id: "ws_1", name: "WS", plan, role }] : [],
		workspaceId: plan ? "ws_1" : null,
		setWorkspaceId: vi.fn(),
		isLoading: false,
		role: plan ? role : null,
		canManage: role !== "agent",
	});
}

function usageFor(plan: Plan) {
	return {
		plan,
		entitlements: planEntitlements(plan),
		usage: { projects: 1, members: 1, responsesThisMonth: 42 },
		monthStartUnix: 0,
	};
}

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<BillingPage />
		</QueryClientProvider>,
	);
}

const clickButton = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
	user.click(screen.getByRole("button", { name }));

beforeEach(() => {
	vi.clearAllMocks();
	useSearchParams.mockReturnValue(new URLSearchParams(""));
	vi.mocked(fetchUsage).mockResolvedValue(usageFor("starter"));
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { href: "" },
	});
});

describe("BillingPage", () => {
	it("shows a skeleton while the workspace is loading", () => {
		vi.mocked(useWorkspace).mockReturnValue({
			workspaces: [],
			workspaceId: null,
			setWorkspaceId: vi.fn(),
			isLoading: true,
			role: null,
			canManage: false,
		});
		renderPage();
		expect(screen.queryByText("Current plan")).not.toBeInTheDocument();
	});

	it("no subscription → choosing a tier starts checkout for that plan", async () => {
		setWorkspace("none");
		vi.mocked(startCheckout).mockResolvedValue("https://checkout.stripe.com/x");
		renderPage();

		expect(screen.getByText("No subscription")).toBeInTheDocument();
		await clickButton(userEvent.setup(), /choose starter/i);
		expect(startCheckout).toHaveBeenCalledWith("ws_1", "starter");
		expect(openPortal).not.toHaveBeenCalled();
	});

	it("offers all three paid tiers", () => {
		setWorkspace("none");
		renderPage();
		expect(
			screen.getByRole("button", { name: /choose starter/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /choose growth/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /choose scale/i }),
		).toBeInTheDocument();
	});

	// Data honesty: no free tier, and no invented dollar prices (real amounts
	// live in Stripe and are shown at Checkout). Real entitlement numbers are OK.
	it("never shows a Free tier or an invented dollar price", () => {
		setWorkspace("none");
		renderPage();
		expect(screen.queryByText(/free/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
		// The card-upfront framing is present instead.
		expect(
			screen.getByText(/a card is required to start/i),
		).toBeInTheDocument();
	});

	it("subscribed plan → current tier is marked and Manage opens the portal", async () => {
		setWorkspace("growth");
		vi.mocked(fetchUsage).mockResolvedValue(usageFor("growth"));
		vi.mocked(openPortal).mockResolvedValue("https://billing.stripe.com/x");
		renderPage();

		// Growth tier shows as current; the others remain selectable.
		expect(
			screen.getByRole("button", { name: /current plan/i }),
		).toBeInTheDocument();
		await clickButton(userEvent.setup(), /manage billing/i);
		expect(openPortal).toHaveBeenCalledWith("ws_1");
		expect(startCheckout).not.toHaveBeenCalled();
	});

	it("shows real usage-this-month from the API (no fabrication)", async () => {
		setWorkspace("growth");
		vi.mocked(fetchUsage).mockResolvedValue(usageFor("growth"));
		renderPage();
		// 42 responses / 5,000 included (Growth's real quota).
		await waitFor(() =>
			expect(screen.getByText(/42 \/ 5,000/)).toBeInTheDocument(),
		);
	});

	it("a non-owner cannot trigger checkout (buttons disabled)", () => {
		setWorkspace("none", "agent");
		renderPage();
		expect(
			screen.getByRole("button", { name: /choose starter/i }),
		).toBeDisabled();
		expect(
			screen.getByText(/only a workspace owner can manage billing/i),
		).toBeInTheDocument();
	});

	it("shows a friendly notice (not a raw error) when billing isn't configured", async () => {
		setWorkspace("none");
		vi.mocked(startCheckout).mockRejectedValue(new Error("API 503"));
		vi.mocked(isBillingNotConfigured).mockReturnValue(true);
		renderPage();

		await clickButton(userEvent.setup(), /choose starter/i);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/billing isn't enabled yet/i,
		);
	});

	it("shows a generic notice on other checkout failures", async () => {
		setWorkspace("none");
		vi.mocked(startCheckout).mockRejectedValue(new Error("API 500"));
		vi.mocked(isBillingNotConfigured).mockReturnValue(false);
		renderPage();

		await clickButton(userEvent.setup(), /choose starter/i);
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(/something went wrong/i);
		expect(alert).not.toHaveTextContent(/500/);
	});

	it("shows the success banner after returning from checkout", () => {
		setWorkspace("none");
		useSearchParams.mockReturnValue(new URLSearchParams("status=success"));
		renderPage();
		expect(screen.getByRole("status")).toHaveTextContent(/payment received/i);
	});

	it("shows the cancel banner when checkout was abandoned", () => {
		setWorkspace("none");
		useSearchParams.mockReturnValue(new URLSearchParams("status=cancel"));
		renderPage();
		expect(screen.getByRole("status")).toHaveTextContent(/canceled/i);
	});
});
