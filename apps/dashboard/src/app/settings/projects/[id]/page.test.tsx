import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import ProjectSettingsPage from "./page";
import type { Project } from "./types";

vi.mock("next/navigation", () => ({
	useParams: () => ({ id: "p1" }),
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => ({ workspaceId: "ws1", role: "owner" }),
}));
vi.mock("@/lib/billing", () => ({
	fetchUsage: vi.fn().mockResolvedValue({
		entitlements: { branding: "badge" },
	}),
}));
vi.mock("@/lib/account", () => ({
	ACCOUNT_KEY: ["account"],
	fetchAccount: vi.fn().mockResolvedValue({ email: "owner@acme.com" }),
}));
// ModelPicker pulls the gateway snapshot + Radix; stub it for the page test.
vi.mock("./ModelPicker", () => ({
	ModelPicker: () => <div data-testid="mp" />,
}));
vi.mock("@/lib/api", () => ({
	api: vi.fn(),
	describeApiError: () => "err",
	ApiError: class extends Error {},
}));

const PROJECT: Project = {
	id: "p1",
	name: "Acme",
	publicKey: "pk_x",
	systemPrompt: "Be helpful.",
	activeSystemPromptId: null,
	knowledgeText: "",
	model: "gpt-5.4-mini",
	brandColor: "#4f46e5",
	welcomeMessage: "Hi",
	escalationThreshold: 3,
	notifyEmail: null,
	slackWebhookUrl: null,
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(api).mockImplementation(
		async (path: string, opts: { method?: string } = {}) => {
			if (path === "/api/projects" && (!opts.method || opts.method === "GET"))
				return { projects: [PROJECT] } as never;
			return {} as never;
		},
	);
});

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		createElement(
			QueryClientProvider,
			{ client },
			createElement(ProjectSettingsPage),
		) as ReactNode,
	);
}

describe("ProjectSettingsPage (tabbed)", () => {
	it("renders the four tabs", async () => {
		renderPage();
		await screen.findByRole("heading", { name: "Acme" });
		for (const t of ["General", "Widget", "Behavior", "Members"]) {
			expect(screen.getByRole("button", { name: t })).toBeInTheDocument();
		}
	});

	it("editing a notify email on Behavior and saving PATCHes notifyEmail (the newly-exposed field)", async () => {
		const user = userEvent.setup();
		renderPage();
		await screen.findByRole("heading", { name: "Acme" });

		await user.click(screen.getByRole("button", { name: "Behavior" }));
		await user.type(screen.getByLabelText(/notify email/i), "team@acme.com");
		await user.click(
			await screen.findByRole("button", { name: /save changes/i }),
		);

		await waitFor(() => {
			const patch = vi
				.mocked(api)
				.mock.calls.find(
					(c) =>
						c[0] === "/api/projects/p1" &&
						(c[1] as { method?: string })?.method === "PATCH",
				);
			expect(patch, "expected a PATCH to /api/projects/p1").toBeTruthy();
			expect(
				(patch![1] as { body: Record<string, unknown> }).body,
			).toMatchObject({ notifyEmail: "team@acme.com" });
		});
	});
});
