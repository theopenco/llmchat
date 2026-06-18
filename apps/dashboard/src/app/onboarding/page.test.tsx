import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useOnboardingState } from "@/lib/use-onboarding";

import OnboardingPage from "./page";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/use-onboarding", () => ({ useOnboardingState: vi.fn() }));
// Mock only the transport; keep ApiError / isWorkspaceAuthError real so the
// self-heal branch is exercised exactly as in production.
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

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

/** Welcome → Create your bot → fill name → Continue (creates the project). */
async function createBot(
	user: ReturnType<typeof userEvent.setup>,
	name = "Acme Tools",
) {
	await user.click(screen.getByRole("button", { name: /get started/i }));
	await user.type(screen.getByLabelText(/bot name/i), name);
	await user.click(screen.getByRole("button", { name: /continue/i }));
}

beforeEach(() => {
	vi.clearAllMocks();
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
				project: {
					id: "p1",
					publicKey: "pk_live",
					brandColor: "#6366F1",
					name: "Acme",
				},
			};
		}
		return {};
	});
});

describe("OnboardingPage", () => {
	it("creates a project with seeded prompt/welcome/brand color, then advances to sources", async () => {
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme Tools");

		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: expect.objectContaining({
					name: "Acme Tools",
					systemPrompt: expect.stringContaining("Acme Tools"),
					welcomeMessage: expect.stringContaining("Acme Tools"),
					brandColor: "#6366F1",
				}),
			}),
		);
		// No workspace creation needed — one already resolved.
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());
		// Lands on the Add sources step.
		expect(
			await screen.findByRole("heading", { name: /add sources/i }),
		).toBeInTheDocument();
	});

	it("install step shows the public-key snippet and finishing routes to the project page", async () => {
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme Tools");

		// Skip sources → Install widget.
		await user.click(screen.getByRole("button", { name: /skip for now/i }));
		expect(
			await screen.findByRole("heading", { name: /install widget/i }),
		).toBeInTheDocument();
		const snippet = document.querySelector("pre")?.textContent ?? "";
		expect(snippet).toContain("pk_live");

		// Continue → You're all set → Go to dashboard routes to the project page.
		await user.click(screen.getByRole("button", { name: /^continue$/i }));
		await user.click(screen.getByRole("button", { name: /go to dashboard/i }));
		expect(push).toHaveBeenCalledWith("/settings/projects/p1");
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
					project: { id: "p2", publicKey: "pk_x", brandColor: "#6366F1" },
				};
			}
			return {};
		});
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme");

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({ workspaceId: "ws-new" }),
		);
		expect(
			await screen.findByRole("heading", { name: /add sources/i }),
		).toBeInTheDocument();
	});

	it("self-heals a stale/foreign workspace: 403 → provision fresh → retry → sources", async () => {
		vi.mocked(useOnboardingState).mockReturnValue({
			state: "needs-onboarding",
			workspaceId: "ws-foreign",
		});
		const projectCalls: string[] = [];
		vi.mocked(api).mockImplementation(async (path: string, opts?: unknown) => {
			if (path === "/api/projects") {
				const wsId = (opts as { workspaceId?: string } | undefined)
					?.workspaceId;
				projectCalls.push(wsId ?? "");
				if (wsId === "ws-foreign")
					throw new ApiError(403, '{"error":"forbidden"}');
				return {
					project: { id: "p3", publicKey: "pk_ok", brandColor: "#6366F1" },
				};
			}
			if (path === "/api/workspaces") return { workspace: { id: "ws-fresh" } };
			return {};
		});
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme");

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(projectCalls).toEqual(["ws-foreign", "ws-fresh"]);
		expect(
			await screen.findByRole("heading", { name: /add sources/i }),
		).toBeInTheDocument();
	});

	it("does not retry on a non-workspace error (e.g. validation 422)", async () => {
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/projects")
				throw new ApiError(422, '{"error":"bad input"}');
			return {};
		});
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme");

		// No workspace provisioning — the error isn't a workspace-auth failure;
		// stays on the Create-your-bot step.
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());
		expect(
			screen.getByRole("heading", { name: /create your bot/i }),
		).toBeInTheDocument();
	});

	it("adds a source to the created project", async () => {
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/projects") {
				return {
					project: { id: "p1", publicKey: "pk_live", brandColor: "#6366F1" },
				};
			}
			if (path === "/api/projects/p1/sources") {
				return { source: { id: "s1", url: "https://acme.com/help" } };
			}
			return {};
		});
		const user = userEvent.setup();
		renderPage();
		await createBot(user, "Acme Tools");

		await user.type(
			screen.getByLabelText(/source url/i),
			"https://acme.com/help",
		);
		await user.click(screen.getByRole("button", { name: /^add$/i }));

		expect(api).toHaveBeenCalledWith(
			"/api/projects/p1/sources",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: { url: "https://acme.com/help" },
			}),
		);
		expect(
			await screen.findByText("https://acme.com/help"),
		).toBeInTheDocument();
	});
});
