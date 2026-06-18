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
vi.mock("sonner", () => ({
	toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
// Mock only the transport; keep ApiError / isWorkspaceAuthError real so the
// self-heal branch is exercised exactly as in production.
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

// The widget package is exercised in its own suite; here we stub the chat
// primitives to a minimal text UI so we can drive the conversation, and the
// live Widget to a marker (it would otherwise open a real /v1/chat transport).
vi.mock("@llmchat/widget/styles", () => ({ widgetStyles: "" }));
vi.mock("@llmchat/widget", () => ({
	Widget: () => <div data-testid="live-widget" />,
}));
vi.mock("@llmchat/widget/chat", () => ({
	WidgetFrame: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	MessageList: ({
		messages,
		error,
	}: {
		messages: { id: string; content: string }[];
		error: string | null;
	}) => (
		<div>
			{messages.map((m) => (
				<p key={m.id}>{m.content}</p>
			))}
			{error && <div role="alert">{error}</div>}
		</div>
	),
	Composer: ({
		value,
		disabled,
		onChange,
		onSubmit,
	}: {
		value: string;
		disabled: boolean;
		onChange: (v: string) => void;
		onSubmit: () => void;
	}) => (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit();
			}}
		>
			<textarea
				aria-label="Message"
				value={value}
				disabled={disabled}
				onChange={(e) => onChange(e.target.value)}
			/>
			<button type="submit">Send</button>
		</form>
	),
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

async function answerText(u: ReturnType<typeof userEvent.setup>, text: string) {
	const box = await screen.findByLabelText(/message/i);
	await u.clear(box);
	await u.type(box, text);
	await u.click(screen.getByRole("button", { name: /send/i }));
}

/** Walk the scripted interview: name → welcome (use suggested) → brand → source. */
async function interview(
	u: ReturnType<typeof userEvent.setup>,
	opts: { name?: string; color?: RegExp; source?: string } = {},
) {
	const { name = "Acme Tools", color = /indigo/i, source } = opts;

	await answerText(u, name); // name
	await screen.findByText(/greet visitors/i); // welcome prompt
	await u.click(screen.getByRole("button", { name: /send/i })); // accept prefilled
	await screen.findByText(/brand color/i); // brand prompt
	await u.click(screen.getByRole("button", { name: color })); // pick color chip
	await screen.findByText(/website or docs/i); // source prompt
	if (source) {
		await answerText(u, source);
	} else {
		await u.click(screen.getByRole("button", { name: /skip for now/i }));
	}
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
				project: { id: "p1", publicKey: "pk_live", brandColor: "#6366F1" },
			};
		}
		return {};
	});
});

describe("OnboardingPage (conversational)", () => {
	it("opens with the concierge interview, not a form", async () => {
		renderPage();
		expect(
			await screen.findByRole("heading", {
				name: /build your support bot/i,
			}),
		).toBeInTheDocument();
		// The concierge has greeted and asked the first question.
		expect(await screen.findByText(/setup assistant/i)).toBeInTheDocument();
		expect(
			await screen.findByText(/what's your business or product called/i),
		).toBeInTheDocument();
	});

	it("provisions the project from the interview answers, then reveals the live bot", async () => {
		const u = user();
		renderPage();
		await interview(u, { name: "Acme Tools" });

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

		// Payoff: the real bot is mounted and the embed snippet shows the key.
		expect(await screen.findByTestId("live-widget")).toBeInTheDocument();
		const snippet = document.querySelector("pre")?.textContent ?? "";
		expect(snippet).toContain("pk_live");

		await u.click(screen.getByRole("button", { name: /go to dashboard/i }));
		expect(push).toHaveBeenCalledWith("/settings/projects/p1");
	});

	it("adds a knowledge source when the user gives a URL instead of skipping", async () => {
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
		await interview(u, { source: "https://acme.com/help" });

		expect(api).toHaveBeenCalledWith(
			"/api/projects/p1/sources",
			expect.objectContaining({
				method: "POST",
				workspaceId: "ws-1",
				body: { url: "https://acme.com/help" },
			}),
		);
		expect(await screen.findByTestId("live-widget")).toBeInTheDocument();
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
		await interview(u, { name: "Acme" });

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(api).toHaveBeenCalledWith(
			"/api/projects",
			expect.objectContaining({ workspaceId: "ws-new" }),
		);
		expect(await screen.findByTestId("live-widget")).toBeInTheDocument();
	});

	it("self-heals a stale/foreign workspace: 403 → provision fresh → retry → live bot", async () => {
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
		await interview(u, { name: "Acme" });

		expect(api).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST", body: { name: "Acme" } }),
		);
		expect(projectCalls).toEqual(["ws-foreign", "ws-fresh"]);
		expect(await screen.findByTestId("live-widget")).toBeInTheDocument();
	});

	it("offers a retry without losing answers when provisioning fails", async () => {
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === "/api/projects") throw new ApiError(500, '{"error":"boom"}');
			return {};
		});
		const u = user();
		renderPage();
		await interview(u, { name: "Acme" });

		// Stayed in the chat; a retry affordance appears (no live widget yet).
		expect(
			await screen.findByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
		expect(screen.queryByTestId("live-widget")).not.toBeInTheDocument();
	});
});
