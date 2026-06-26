import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { planEntitlements } from "@llmchat/shared";

import { fetchUsage } from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";

import { UsageMeter } from "./usage-meter";

vi.mock("@/lib/workspace", () => ({ useWorkspace: vi.fn() }));
vi.mock("@/lib/billing", () => ({ fetchUsage: vi.fn() }));

function renderMeter() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(UsageMeter),
		) as ReactNode,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useWorkspace).mockReturnValue({
		workspaces: [],
		workspaceId: "ws1",
		setWorkspaceId: vi.fn(),
		isLoading: false,
		role: "owner",
		canManage: true,
	});
});

describe("UsageMeter", () => {
	it("shows the LIVE response count and an honest, unenforced reference bar", async () => {
		vi.mocked(fetchUsage).mockResolvedValue({
			plan: "growth",
			exempt: false,
			entitlements: planEntitlements("growth"),
			usage: { projects: 1, members: 1, responsesThisMonth: 42 },
			availablePlans: ["growth"],
			monthStartUnix: 0,
		});
		renderMeter();
		// Real count from /billing/usage — not fabricated.
		await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
		expect(screen.getByText("Growth plan")).toBeInTheDocument();
		expect(screen.getByText(/plan limit 12,000/i)).toBeInTheDocument();
		expect(screen.getByText(/aren.t enforced yet/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /billing/i })).toHaveAttribute(
			"href",
			"/settings/billing",
		);
	});

	it("renders nothing until usage resolves (no fabricated zero)", () => {
		vi.mocked(fetchUsage).mockReturnValue(new Promise(() => {}));
		const { container } = renderMeter();
		expect(container).toBeEmptyDOMElement();
	});

	it("an exempt workspace shows no reference bar", async () => {
		vi.mocked(fetchUsage).mockResolvedValue({
			plan: "none",
			exempt: true,
			entitlements: planEntitlements("none"),
			usage: { projects: 9, members: 9, responsesThisMonth: 7 },
			availablePlans: [],
			monthStartUnix: 0,
		});
		renderMeter();
		await waitFor(() =>
			expect(screen.getByText("Internal")).toBeInTheDocument(),
		);
		expect(screen.queryByText(/enforced yet/i)).not.toBeInTheDocument();
	});

	it("labels an unpaid workspace 'No plan' (not 'No plan plan')", async () => {
		vi.mocked(fetchUsage).mockResolvedValue({
			plan: "none",
			exempt: false,
			entitlements: planEntitlements("none"),
			usage: { projects: 0, members: 1, responsesThisMonth: 0 },
			availablePlans: [],
			monthStartUnix: 0,
		});
		renderMeter();
		await waitFor(() =>
			expect(screen.getByText("No plan")).toBeInTheDocument(),
		);
		expect(screen.queryByText(/no plan plan/i)).toBeNull();
	});
});
