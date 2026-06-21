import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import InboxPage from "./page";

import type { Tag } from "./_components/types";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// Admin in a workspace with a project, so the inbox renders (not onboarding) and
// the "Manage tags" affordance is available.
vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => ({
		workspaces: [{ id: "ws1", name: "Acme" }],
		workspaceId: "ws1",
		role: "admin",
		canManage: true,
		isLoading: false,
	}),
}));

vi.mock("@/lib/analytics", () => ({
	track: vi.fn(),
	ANALYTICS_EVENTS: new Proxy({}, { get: () => "evt" }),
}));

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// Only the transport is mocked; ApiError / describeApiError stay real.
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

// MessageThread (imported by the page) pulls useStickToBottom from the widget;
// the thread isn't rendered in this test, but the import must resolve.
vi.mock("@llmchat/widget/chat", () => ({
	useStickToBottom: () => ({
		containerRef: { current: null },
		atBottom: true,
		scrollToBottom: vi.fn(),
	}),
}));

/** Every api() call, in order, so we can assert what the list refetched with. */
let calls: { path: string; method: string }[];
let tagsState: Tag[];

function convPage(path: string) {
	// Reflect the filter in the payload just enough to be realistic; the test
	// asserts on the request URL, not these rows.
	const url = new URL(`http://x${path}`);
	const filtered = url.searchParams.get("tagIds");
	const tags =
		filtered && filtered.includes("t1")
			? [{ id: "t1", name: "Billing", color: "#6366f1" }]
			: tagsState.find((t) => t.id === "t1")
				? [{ id: "t1", name: "Billing", color: "#6366f1" }]
				: [];
	return {
		conversations: [
			{
				id: "c1",
				clientId: "c",
				name: "Bob",
				email: null,
				ipAddress: null,
				userAgent: null,
				messageCount: 1,
				escalatedAt: null,
				archivedAt: null,
				createdAt: "2026-06-16T05:00:00.000Z",
				updatedAt: "2026-06-16T05:00:00.000Z",
				csatRating: null,
				tags,
			},
		],
		nextCursor: null,
	};
}

function setupApi() {
	calls = [];
	tagsState = [
		{ id: "t1", name: "Billing", color: "#6366f1", count: 2 },
		{ id: "t2", name: "Bug", color: "#ef4444", count: 0 },
	];
	vi.mocked(api).mockImplementation(
		async (path: string, opts: { method?: string } = {}) => {
			const method = opts.method ?? "GET";
			calls.push({ path, method });
			if (path === "/api/projects")
				return { projects: [{ id: "p1", name: "Bot", brandColor: "#000000" }] };
			if (path === "/api/tags") return { tags: tagsState };
			if (path.startsWith("/api/projects/p1/conversations/stats"))
				return { total: 1, escalated: 0, resolved: 0, avgRating: null };
			if (path.startsWith("/api/projects/p1/conversations"))
				return convPage(path);
			if (method === "DELETE" && path === "/api/tags/t1") {
				tagsState = tagsState.filter((t) => t.id !== "t1");
				return { ok: true };
			}
			return {};
		},
	);
}

function renderInbox() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<InboxPage />
		</QueryClientProvider>,
	);
}

const listCalls = () =>
	calls.filter(
		(c) =>
			c.method === "GET" &&
			c.path.startsWith("/api/projects/p1/conversations") &&
			!c.path.includes("/stats"),
	);

beforeEach(() => {
	vi.clearAllMocks();
	setupApi();
});

describe("InboxPage — deleting a filtered tag reconciles the filter", () => {
	it("drops the deleted tag id from the active filter and refetches the list without it", async () => {
		const user = userEvent.setup();
		renderInbox();

		// The inbox is ready once the project + tags have loaded.
		await screen.findByRole("heading", { name: "Conversations" });
		await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));

		// Select the "Billing" tag in the toolbar filter → it becomes part of the
		// active filter and the list refetches scoped to it.
		await user.click(screen.getByRole("button", { name: /^tags$/i }));
		await user.click(await screen.findByRole("option", { name: /Billing/ }));
		await waitFor(() =>
			expect(listCalls().some((c) => c.path.includes("tagIds=t1"))).toBe(true),
		);
		// The filter now shows one active selection.
		expect(screen.getByRole("button", { name: "Tags 1" })).toBeInTheDocument();

		// Open Manage tags and delete the currently-filtered "Billing" tag.
		await user.click(screen.getByRole("button", { name: /manage tags/i }));
		const dialog = await screen.findByRole("dialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Delete Billing" }),
		);
		const confirm = await screen.findByRole("alertdialog");
		// Record where the call log is BEFORE the delete so we only inspect refetches
		// that happen afterwards.
		const before = calls.length;
		await user.click(within(confirm).getByRole("button", { name: "Delete" }));

		// 1) The list refetched with the CORRECTED filter: after the delete, a
		//    conversations request fires with the deleted tag id gone from the filter
		//    (no tagIds at all, since it was the only selection) — the list ends up
		//    scoped without the dangling id.
		const postList = () =>
			calls
				.slice(before)
				.filter(
					(c) =>
						c.method === "GET" &&
						c.path.startsWith("/api/projects/p1/conversations") &&
						!c.path.includes("/stats"),
				);
		await waitFor(() => {
			const post = postList();
			expect(post.length).toBeGreaterThan(0);
			// A corrected refetch (no tagIds) happened…
			expect(post.some((c) => !c.path.includes("tagIds"))).toBe(true);
			// …and the LATEST list request carries no tag filter (it settled corrected,
			// never leaving the deleted id dangling on the server query).
			expect(post.at(-1)!.path.includes("tagIds=t1")).toBe(false);
		});

		// 2) No dangling filter id in the UI either: close the (modal) manage dialog
		//    and the toolbar filter no longer shows an active selection.
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(screen.getByRole("button", { name: "Tags" })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Tags 1" }),
		).not.toBeInTheDocument();
	});
});
