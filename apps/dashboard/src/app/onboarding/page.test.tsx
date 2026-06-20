import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { planEntitlements } from "@llmchat/shared";

import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { fetchUsage } from "@/lib/billing";
import { useOnboardingState } from "@/lib/use-onboarding";

import OnboardingPage from "./page";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, replace }),
	useSearchParams: () => searchParams,
}));
vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/use-onboarding", () => ({ useOnboardingState: vi.fn() }));
vi.mock("sonner", () => ({
	toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
// Mock only the transport; keep ApiError / isWorkspaceAuthError real so the
// self-heal branch is exercised exactly as in production.
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

// Billing: the onboarding paywall gate reads fetchUsage. Default to a paid plan
// so the form-flow tests aren't gated; the paywall test overrides to "none".
vi.mock("@/lib/billing", () => ({
	fetchUsage: vi.fn(),
	startCheckout: vi.fn(),
	redirectToStripeCheckout: vi.fn(),
	isBillingNotConfigured: vi.fn(() => false),
}));

// The widget package is exercised in its own suite. Onboarding now ends at the
// form + live preview (no in-flow live bot), so we only need the chat primitives
// the live preview uses, plus the styles import.
vi.mock("@llmchat/widget/styles", () => ({ widgetStyles: "" }));
vi.mock("@llmchat/widget/chat", () => ({
	WidgetFrame: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	MessageList: ({ greeting }: { greeting: string }) => <p>{greeting}</p>,
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

const user = () => userEvent.setup();

/** Fill the setup form and submit. Welcome/brand keep their defaults unless a
 * caller overrides; source is optional. */
async function fillForm(
	u: ReturnType<typeof userEvent.setup>,
	opts: { name?: string; source?: string } = {},
) {
	const { name = "Acme Tools", source } = opts;
	const nameField = await screen.findByLabelText(/agent name/i);
	await u.clear(nameField);
	await u.type(nameField, name);
	if (source) {
		await u.type(screen.getByLabelText(/website to learn from/i), source);
	}
	await u.click(
		screen.getByRole("button", { name: /create (my|this) agent/i }),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	searchParams = new URLSearchParams();
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
				project: { id: "p1", publicKey: "pk_live", brandColor: "#6366F1" },
			};
		}
		return {};
	});
	// Default: an active (paid) plan, so the form-flow tests aren't paywalled.
	vi.mocked(fetchUsage).mockResolvedValue({
		plan: "growth",
		exempt: false,
		entitlements: planEntitlements("growth"),
		usage: { projects: 0, members: 1, responsesThisMonth: 0 },
		availablePlans: ["starter", "growth", "scale"],
		monthStartUnix: 0,
	});
});

describe("OnboardingPage (form redesign)", () => {
	it("gates an unpaid workspace behind the paywall — the build form is not shown", async () => {
		vi.mocked(fetchUsage).mockResolvedValue({
			plan: "none",
			exempt: false,
			entitlements: planEntitlements("none"),
			usage: { projects: 0, members: 1, responsesThisMonth: 0 },
			availablePlans: ["starter", "growth", "scale"],
			monthStartUnix: 0,
		});
		renderPage();
		expect(
			await screen.findByRole("heading", {
				name: /choose a plan to launch your agent/i,
			}),
		).toBeInTheDocument();
		// The build form must not be reachable while unpaid.
		expect(screen.queryByLabelText(/agent name/i)).not.toBeInTheDocument();
	});

	it("lets an exempt internal workspace skip the paywall and build", async () => {
		vi.mocked(fetchUsage).mockResolvedValue({
			plan: "none",
			exempt: true,
			entitlements: planEntitlements("none"),
			usage: { projects: 0, members: 1, responsesThisMonth: 0 },
			availablePlans: [],
			monthStartUnix: 0,
		});
		renderPage();
		// Exempt → straight to the build form, no paywall.
		expect(await screen.findByLabelText(/agent name/i)).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", {
				name: /choose a plan to launch your agent/i,
			}),
		).not.toBeInTheDocument();
	});

	it("opens with a plain form and a live preview — not a chat", async () => {
		renderPage();
		expect(
			await screen.findByRole("heading", {
				name: /build your support agent/i,
			}),
		).toBeInTheDocument();
		// The real fields are present…
		expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/welcome message/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /create my agent/i }),
		).toBeInTheDocument();
		// …and the old concierge chat is gone.
		expect(screen.queryByText(/setup assistant/i)).not.toBeInTheDocument();
	});

	it("requires a name before it will provision", async () => {
		const u = user();
		renderPage();
		// Submit with the name empty (wait for the form past the plan-resolve gate).
		await u.click(
			await screen.findByRole("button", { name: /create my agent/i }),
		);
		expect(
			await screen.findByText(/give your agent a name/i),
		).toBeInTheDocument();
		expect(api).not.toHaveBeenCalledWith("/api/projects", expect.anything());
	});

	it("provisions the project from the form, then routes to its project page", async () => {
		const u = user();
		renderPage();
		await fillForm(u, { name: "Acme Tools" });

		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: expect.objectContaining({
					name: "Acme Tools",
					systemPrompt: expect.stringContaining("Acme Tools"),
					welcomeMessage: expect.stringContaining("How can I help"),
					brandColor: "#6366F1", // Indigo default
				}),
			}),
		);
		// No workspace creation needed — one already resolved.
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());

		// Onboarding ends here: straight to the agent's project page (its
		// settings, where the embed snippet lives) — no in-flow live bot.
		await waitFor(() =>
			expect(push).toHaveBeenCalledWith("/settings/projects/p1"),
		);
	});

	it("adds a knowledge source when a URL is provided", async () => {
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
		const u = user();
		renderPage();
		await fillForm(u, { source: "https://acme.com/help" });

		expect(api).toHaveBeenCalledWith(
			"/api/projects/p1/sources",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: { url: "https://acme.com/help" },
			}),
		);
		await waitFor(() =>
			expect(push).toHaveBeenCalledWith("/settings/projects/p1"),
		);
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
		const u = user();
		renderPage();
		await fillForm(u, { name: "Acme" });

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({ workspaceId: "ws-new" }),
		);
		await waitFor(() =>
			expect(push).toHaveBeenCalledWith("/settings/projects/p2"),
		);
	});

	it("self-heals a stale/foreign workspace: 403 → provision fresh → retry → live agent", async () => {
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
		const u = user();
		renderPage();
		await fillForm(u, { name: "Acme" });

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(projectCalls).toEqual(["ws-foreign", "ws-fresh"]);
		await waitFor(() =>
			expect(push).toHaveBeenCalledWith("/settings/projects/p3"),
		);
	});

	it("offers a retry without losing the form when provisioning fails", async () => {
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/projects") throw new ApiError(500, '{"error":"boom"}');
			return {};
		});
		const u = user();
		renderPage();
		await fillForm(u, { name: "Acme" });

		expect(
			await screen.findByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
		// Provisioning failed → we never navigate away.
		expect(push).not.toHaveBeenCalled();
		// The form is still there with the typed name intact.
		expect(screen.getByLabelText(/agent name/i)).toHaveValue("Acme");
	});
});

describe("OnboardingPage — new-bot mode (already-onboarded user)", () => {
	beforeEach(() => {
		// ?new=1 and an existing, fully-onboarded workspace.
		searchParams = new URLSearchParams("new=1");
		vi.mocked(useOnboardingState).mockReturnValue({
			state: "ready",
			workspaceId: "ws-1",
		});
	});

	it("shows the flow (not redirected to the dashboard) for a ready user", async () => {
		renderPage();
		expect(
			await screen.findByRole("heading", {
				name: /add another support agent/i,
			}),
		).toBeInTheDocument();
		expect(replace).not.toHaveBeenCalledWith("/inbox");
	});

	it("creates a NEW project in the existing workspace — no duplication, no new workspace, lands selected", async () => {
		const u = user();
		renderPage();
		await fillForm(u, { name: "Second Bot" });

		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: expect.objectContaining({ name: "Second Bot" }),
			}),
		);
		const projectPosts = vi
			.mocked(api)
			.mock.calls.filter(
				([path, opts]) =>
					path === "/api/projects" &&
					(opts as { method?: string } | undefined)?.method === "POST",
			);
		expect(projectPosts).toHaveLength(1);
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());

		// New-bot also ends at the new agent's project page.
		await waitFor(() =>
			expect(push).toHaveBeenCalledWith("/settings/projects/p1"),
		);
	});

	it("does not re-provision the workspace on a 403 (no self-heal in new-bot mode)", async () => {
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/projects")
				throw new ApiError(403, '{"error":"forbidden"}');
			return {};
		});
		const u = user();
		renderPage();
		await fillForm(u, { name: "Second Bot" });

		expect(
			await screen.findByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
		expect(api).not.toHaveBeenCalledWith("/api/workspaces", expect.anything());
	});
});
