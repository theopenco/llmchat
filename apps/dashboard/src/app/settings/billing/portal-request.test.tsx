import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { planEntitlements } from "@llmchat/shared";

import { useWorkspace } from "@/lib/workspace";

import BillingPage from "./page";

// Adversarial: do NOT mock @/lib/billing here — exercise the real openPortal →
// api() → fetch path and assert the actual POST /billing/portal request fires
// when "Manage in Stripe" is clicked. (The page-level suite mocks lib/billing;
// this one proves the wiring underneath it.)
vi.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/workspace", () => ({ useWorkspace: vi.fn() }));

const jsonResponse = (obj: unknown) => ({
	ok: true,
	status: 200,
	json: async () => obj,
	text: async () => JSON.stringify(obj),
});

const usage = {
	plan: "growth" as const,
	exempt: false,
	entitlements: planEntitlements("growth"),
	usage: { projects: 1, members: 1, responsesThisMonth: 42 },
	availablePlans: ["starter", "growth", "scale"] as const,
	monthStartUnix: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useWorkspace).mockReturnValue({
		workspaces: [{ id: "ws_1", name: "WS", plan: "growth", role: "owner" }],
		workspaceId: "ws_1",
		setWorkspaceId: vi.fn(),
		isLoading: false,
		role: "owner",
		canManage: true,
	});
	fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/billing/usage")) return jsonResponse(usage);
		if (url.includes("/billing/portal"))
			return jsonResponse({ url: "https://billing.stripe.com/p/session" });
		throw new Error(`unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { href: "", hostname: "localhost" },
	});
});

describe("Billing — Manage in Stripe fires the real portal request", () => {
	it("POSTs /billing/portal with the workspace header", async () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<BillingPage />
			</QueryClientProvider>,
		);

		const manage = await screen.findByRole("button", {
			name: /manage in stripe/i,
		});
		await userEvent.setup().click(manage);

		await waitFor(() => {
			const call = fetchMock.mock.calls.find((c) =>
				String(c[0]).includes("/billing/portal"),
			);
			expect(call, "expected a POST to /billing/portal").toBeTruthy();
			expect((call![1] as RequestInit).method).toBe("POST");
			expect(
				(call![1] as RequestInit).headers as Record<string, string>,
			).toMatchObject({ "x-workspace-id": "ws_1" });
		});
	});
});
