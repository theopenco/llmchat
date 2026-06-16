import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
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
	isBillingNotConfigured: vi.fn(() => false),
}));

function setWorkspace(plan: Plan | null, isLoading = false) {
	vi.mocked(useWorkspace).mockReturnValue({
		workspaces: plan ? [{ id: "ws_1", name: "WS", plan }] : [],
		workspaceId: plan ? "ws_1" : null,
		setWorkspaceId: vi.fn(),
		isLoading,
	});
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

beforeEach(() => {
	vi.clearAllMocks();
	useSearchParams.mockReturnValue(new URLSearchParams(""));
	// Stub navigation so the redirect-on-success doesn't hit jsdom.
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { href: "" },
	});
});

describe("BillingPage", () => {
	it("shows a skeleton while the workspace is loading", () => {
		setWorkspace(null, true);
		renderPage();
		expect(screen.queryByText("Current plan")).not.toBeInTheDocument();
	});

	it("free plan → upgrade starts checkout for the workspace", async () => {
		setWorkspace("free");
		vi.mocked(startCheckout).mockResolvedValue("https://checkout.stripe.com/x");
		renderPage();

		expect(screen.getByText("Free")).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: /upgrade to pro/i }),
		);
		expect(startCheckout).toHaveBeenCalledWith("ws_1");
		expect(openPortal).not.toHaveBeenCalled();
	});

	it("pro plan → manage opens the billing portal", async () => {
		setWorkspace("pro");
		vi.mocked(openPortal).mockResolvedValue("https://billing.stripe.com/x");
		renderPage();

		expect(screen.getByText("Pro")).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: /manage billing/i }),
		);
		expect(openPortal).toHaveBeenCalledWith("ws_1");
		expect(startCheckout).not.toHaveBeenCalled();
	});

	it("shows a friendly notice (not a raw error) when billing isn't configured", async () => {
		setWorkspace("free");
		vi.mocked(startCheckout).mockRejectedValue(new Error("API 503"));
		vi.mocked(isBillingNotConfigured).mockReturnValue(true);
		renderPage();

		await userEvent.click(
			screen.getByRole("button", { name: /upgrade to pro/i }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/billing isn't enabled yet/i,
		);
	});

	it("shows a generic notice on other checkout failures", async () => {
		setWorkspace("free");
		vi.mocked(startCheckout).mockRejectedValue(new Error("API 500"));
		vi.mocked(isBillingNotConfigured).mockReturnValue(false);
		renderPage();

		await userEvent.click(
			screen.getByRole("button", { name: /upgrade to pro/i }),
		);
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(/something went wrong/i);
		expect(alert).not.toHaveTextContent(/500/);
	});

	it("shows the success banner after returning from checkout", () => {
		setWorkspace("free");
		useSearchParams.mockReturnValue(new URLSearchParams("status=success"));
		renderPage();
		expect(screen.getByRole("status")).toHaveTextContent(/payment received/i);
	});

	it("shows the cancel banner when checkout was abandoned", () => {
		setWorkspace("free");
		useSearchParams.mockReturnValue(new URLSearchParams("status=cancel"));
		renderPage();
		expect(screen.getByRole("status")).toHaveTextContent(/canceled/i);
	});
});
