import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { CommandPalette } from "./command-palette";

beforeAll(() => {
	// cmdk / Radix Dialog touch these in jsdom.
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => ({ workspaceId: "ws1" }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

function renderPalette() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<CommandPalette open onOpenChange={() => {}} />
		</QueryClientProvider>,
	);
}

const RESULTS = {
	conversations: [
		{
			id: "c1",
			projectId: "p1",
			projectName: "Acme Support",
			name: "Alice",
			email: null,
			match: { field: "body" as const, snippet: "…I need a refund please…" },
		},
	],
	projects: [{ id: "p1", name: "Acme Support" }],
};

beforeEach(() => vi.clearAllMocks());

describe("CommandPalette", () => {
	it("shows the idle prompt and queries nothing for a sub-2-char term", async () => {
		vi.mocked(api).mockResolvedValue({ conversations: [], projects: [] });
		renderPalette();

		expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();

		await userEvent.type(screen.getByPlaceholderText(/search/i), "a");
		// Give the debounce a chance — it must NOT fire for one character.
		await new Promise((r) => setTimeout(r, 300));
		expect(api).not.toHaveBeenCalled();
	});

	it("debounces to ONE query per search, not one per keystroke", async () => {
		vi.mocked(api).mockResolvedValue({ conversations: [], projects: [] });
		renderPalette();

		await userEvent.type(screen.getByPlaceholderText(/search/i), "refund");

		await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
		expect(vi.mocked(api).mock.calls[0][0]).toBe("/api/search?q=refund");
	});

	it("renders grouped results and routes a conversation into the inbox deep link", async () => {
		vi.mocked(api).mockResolvedValue(RESULTS);
		renderPalette();

		await userEvent.type(screen.getByPlaceholderText(/search/i), "refund");

		// Grouped headings + the real row (the snippet shows why it matched).
		await screen.findByText("Conversations");
		expect(screen.getByText("Alice")).toBeInTheDocument();
		expect(screen.getByText(/refund please/)).toBeInTheDocument();

		// The conversation option's accessible name contains "Alice" (the project
		// option, if any, would not) — unambiguous.
		await userEvent.click(screen.getByRole("option", { name: /Alice/i }));
		expect(push).toHaveBeenCalledWith("/inbox?project=p1&c=c1");
	});

	it("routes a project result to its settings page", async () => {
		// Projects-only so the single "Acme Support" option is unambiguous (a
		// conversation row would also carry its project name as a label).
		vi.mocked(api).mockResolvedValue({
			conversations: [],
			projects: [{ id: "p1", name: "Acme Support" }],
		});
		renderPalette();

		await userEvent.type(screen.getByPlaceholderText(/search/i), "acme");
		await screen.findByText("Projects");

		await userEvent.click(
			screen.getByRole("option", { name: /Acme Support/i }),
		);
		expect(push).toHaveBeenCalledWith("/settings/projects/p1");
	});

	it("honesty rail: clearing the input drops results back to the idle prompt (no stale rows)", async () => {
		vi.mocked(api).mockResolvedValue(RESULTS);
		renderPalette();

		const input = screen.getByPlaceholderText(/search/i);
		await userEvent.type(input, "refund");
		await screen.findByText("Alice");

		// Clearing the live input (as a close-reset does) must hide the cached rows
		// immediately and restore the idle prompt — never leave stale results up.
		await userEvent.clear(input);
		await waitFor(() =>
			expect(
				screen.getByText(/type at least 2 characters/i),
			).toBeInTheDocument(),
		);
		expect(screen.queryByText("Alice")).not.toBeInTheDocument();
	});

	it("honesty rail: shows 'No matches' only after a settled empty query", async () => {
		vi.mocked(api).mockResolvedValue({ conversations: [], projects: [] });
		renderPalette();

		// Nothing typed yet → idle prompt, never 'No matches'.
		expect(screen.queryByText(/no matches/i)).not.toBeInTheDocument();

		await userEvent.type(screen.getByPlaceholderText(/search/i), "zzzznope");
		await waitFor(() =>
			expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
		);
	});
});
