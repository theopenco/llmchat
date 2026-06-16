import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";

import OnboardingPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/use-onboarding", () => ({ useOnboardingState: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<OnboardingPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.mocked(useSession).mockReturnValue({
		data: { user: { id: "u1", email: "a@b.com" } },
		isPending: false,
	} as ReturnType<typeof useSession>);
	vi.mocked(useOnboardingState).mockReturnValue({
		state: "needs-onboarding",
		workspaceId: "ws-1",
	});
	vi.mocked(api).mockImplementation(async (path: string) => {
		if (path === "/api/projects") {
			return {
				project: { publicKey: "pk_live", brandColor: "#000000", name: "Acme" },
			};
		}
		return {};
	});
});

describe("OnboardingPage", () => {
	it("creates a project with a name-seeded prompt, then shows the install snippet", async () => {
		const user = userEvent.setup();
		renderPage();

		await user.type(
			screen.getByLabelText(/business or chatbot name/i),
			"Acme Tools",
		);
		await user.click(screen.getByRole("button", { name: /create chatbot/i }));

		// Project created against the resolved workspace with seeded copy.
		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: expect.objectContaining({
					name: "Acme Tools",
					systemPrompt: expect.stringContaining("Acme Tools"),
					welcomeMessage: expect.stringContaining("Acme Tools"),
				}),
			}),
		);
		// No workspace creation needed — one already resolved.
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());

		// Finish screen with the new project's key wired into the snippet.
		expect(await screen.findByText(/acme tools is ready/i)).toBeInTheDocument();
		const snippet = document.querySelector("pre")?.textContent ?? "";
		expect(snippet).toContain("pk_live");
	});

	it("provisions a workspace first when the account has none", async () => {
		vi.mocked(useOnboardingState).mockReturnValue({
			state: "needs-onboarding",
			workspaceId: null,
		});
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/workspaces") return { workspace: { id: "ws-new" } };
			if (path === "/api/projects") {
				return {
					project: { publicKey: "pk_x", brandColor: "#000000", name: "Acme" },
				};
			}
			return {};
		});
		const user = userEvent.setup();
		renderPage();

		await user.type(screen.getByLabelText(/business or chatbot name/i), "Acme");
		await user.click(screen.getByRole("button", { name: /create chatbot/i }));

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		// The project lands in the freshly created workspace.
		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({ workspaceId: "ws-new" }),
		);
		expect(await screen.findByText(/acme is ready/i)).toBeInTheDocument();
	});
});
