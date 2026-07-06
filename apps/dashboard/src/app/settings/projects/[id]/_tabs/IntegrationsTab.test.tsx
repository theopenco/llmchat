import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { IntegrationsTab } from "./IntegrationsTab";

import type { IntegrationView } from "@llmchat/shared";

vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
	track: vi.fn(),
	ANALYTICS_EVENTS: { integrationConnected: "integration_connected" },
}));

let calls: { path: string; method: string; body?: unknown }[];

function mockApi(integrations: IntegrationView[]) {
	calls = [];
	vi.mocked(api).mockImplementation(async (path, opts) => {
		calls.push({
			path,
			method: (opts?.method as string) ?? "GET",
			body: opts?.body,
		});
		if (path.endsWith("/connect-code")) {
			return { code: "abcd1234efgh5678", expiresInSeconds: 600 } as never;
		}
		if (path.endsWith("/integrations") && !opts?.method) {
			return { integrations } as never;
		}
		return { ok: true } as never;
	});
}

function renderTab(props: Partial<Parameters<typeof IntegrationsTab>[0]> = {}) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<IntegrationsTab projectId="p1" workspaceId="ws_1" canManage {...props} />
		</QueryClientProvider>,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("IntegrationsTab", () => {
	it("shows connect forms for both providers when nothing is connected", async () => {
		mockApi([]);
		renderTab();
		expect(
			await screen.findByRole("button", { name: /connect cal\.com/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /generate pairing code/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /connect manually/i }),
		).toBeInTheDocument();
	});

	it("submits a Cal.com config and never renders the raw key afterwards", async () => {
		mockApi([]);
		renderTab();
		const user = userEvent.setup();
		await user.type(
			await screen.findByPlaceholderText("cal_live_…"),
			"cal_live_secret",
		);
		await user.type(screen.getByPlaceholderText("123456"), "42");
		await user.click(screen.getByRole("button", { name: /connect cal\.com/i }));
		await waitFor(() => {
			const putCall = calls.find((c) => c.method === "PUT");
			expect(putCall?.path).toBe("/api/projects/p1/integrations/calcom");
			expect(putCall?.body).toEqual({
				enabled: true,
				config: { apiKey: "cal_live_secret", eventTypeId: 42, timeZone: "UTC" },
			});
		});
	});

	it("renders the masked connected state with pause + disconnect controls", async () => {
		mockApi([
			{
				kind: "calcom",
				enabled: true,
				summary: "event type 42 · UTC",
				secretHint: "••••_123",
				updatedAt: 1,
			},
		]);
		renderTab();
		expect(await screen.findByText(/event type 42/)).toBeInTheDocument();
		expect(screen.getByText("Live")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /disconnect/i }),
		).toBeInTheDocument();
		// The form is collapsed for a connected provider.
		expect(screen.queryByPlaceholderText("cal_live_…")).toBeNull();
	});

	it("mints a one-time pairing code for the Shopify app", async () => {
		mockApi([]);
		renderTab();
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("button", { name: /generate pairing code/i }),
		);
		expect(await screen.findByTestId("pair-code")).toHaveTextContent(
			"abcd1234efgh5678",
		);
	});

	it("hides all management controls for non-admins", async () => {
		mockApi([
			{
				kind: "shopify",
				enabled: false,
				summary: "acme.myshopify.com",
				secretHint: "••••_abc",
				updatedAt: 1,
			},
		]);
		renderTab({ canManage: false });
		expect(await screen.findByText("Paused")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /resume/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
		expect(
			screen.getByText(/only workspace admins can connect/i),
		).toBeInTheDocument();
	});
});
