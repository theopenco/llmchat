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

// Stable router.replace spy (hoisted with the mock) so the onboarding-redirect
// guard can be asserted at the real incident call site.
const routerReplace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
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
			// Thread-detail GET (the windowed message thread for an open conversation)
			// — only fetched once a conversation is selected (e.g. via a deep link).
			if (
				method === "GET" &&
				/^\/api\/projects\/p1\/conversations\/c1(\?|$)/.test(path)
			)
				return {
					conversation: {
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
						summary: null,
					},
					messages: [],
					hasOlder: false,
				};
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
	// Reset the URL between tests so deep-link state never leaks across them.
	window.history.replaceState(null, "", "/inbox");
});

describe("InboxPage — deleting a filtered tag reconciles the filter", () => {
	it("drops the deleted tag id from the active filter and refetches the list without it", async () => {
		const user = userEvent.setup();
		renderInbox();

		// The inbox is ready once the project + tags have loaded.
		await screen.findByRole("heading", { name: "Inbox" });
		await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));

		// Click the "Billing" tag chip → it becomes the active filter and the list
		// refetches scoped to it.
		await user.click(await screen.findByRole("button", { name: "Billing" }));
		await waitFor(() =>
			expect(listCalls().some((c) => c.path.includes("tagIds=t1"))).toBe(true),
		);
		// The Billing chip now reads as the active filter.
		expect(screen.getByRole("button", { name: "Billing" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		// Open Manage tags and delete the currently-filtered "Billing" tag.
		await user.click(screen.getByRole("button", { name: /manage/i }));
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
			// A corrected refetch (no tagIds) happened on the new key.
			expect(post.some((c) => !c.path.includes("tagIds"))).toBe(true);
		});
		// No transient stale request: NO post-delete list call carries the deleted
		// tag id (the redundant conversations invalidation was dropped, so the stale
		// key is never refetched).
		expect(postList().every((c) => !c.path.includes("tagIds=t1"))).toBe(true);

		// 2) No dangling filter id in the UI either: close the (modal) manage dialog
		//    and the toolbar filter no longer shows an active selection.
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Billing" }),
		).not.toBeInTheDocument();
	});
});

describe("InboxPage — ⌘K deep link", () => {
	it("?project=&c= opens that conversation's thread (selects c1 from the URL)", async () => {
		// A deep link from the ⌘K palette (or a shared thread URL).
		window.history.replaceState(null, "", "/inbox?project=p1&c=c1");
		renderInbox();

		await screen.findByRole("heading", { name: "Inbox" });

		// The deep link selected c1 → the windowed thread for c1 is fetched. (No
		// click happened; selection came purely from the URL.)
		await waitFor(() =>
			expect(
				calls.some(
					(c) =>
						c.method === "GET" &&
						/^\/api\/projects\/p1\/conversations\/c1(\?|$)/.test(c.path),
				),
			).toBe(true),
		);
		// The open conversation's name shows in the thread header.
		expect(await screen.findAllByText("Bob")).not.toHaveLength(0);
	});

	it("selecting a conversation syncs the open thread to the URL (shareable)", async () => {
		renderInbox();
		await screen.findByRole("heading", { name: "Inbox" });
		await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));

		// No conversation is open yet → the URL carries no ?c=.
		expect(window.location.search).not.toContain("c=c1");

		const user = userEvent.setup();
		await user.click(await screen.findByText("Bob"));

		// Selecting c1 mirrors it into the URL so the thread is shareable / the ⌘K
		// deep link round-trips.
		await waitFor(() => expect(window.location.search).toContain("c=c1"));
		expect(window.location.search).toContain("project=p1");
	});
});

// The named incident path: the inbox wires `projectsLoaded: projects.isSuccess`
// inline (page.tsx) then redirects to /onboarding only on "needs-onboarding".
// These render-level tests pin that wiring at the real call site — a wrong VALUE
// (e.g. a future `projectsLoaded: true`) compiles but would reintroduce the
// paying-customer bounce / duplicate-workspace bug, and would fail here.
describe("InboxPage — onboarding redirect guards on the projects fetch outcome", () => {
	it("does NOT redirect to /onboarding when the projects fetch FAILS (no false bounce)", async () => {
		vi.mocked(api).mockImplementation(async (path: string, opts = {}) => {
			calls.push({ path, method: opts.method ?? "GET" });
			// A failed projects fetch reports zero projects too — must NOT be read as
			// an empty workspace and bounce the user (where rebuilding dupes a ws).
			if (path === "/api/projects") throw new Error("projects fetch failed");
			if (path === "/api/tags") return { tags: tagsState };
			return {};
		});
		renderInbox();
		// Let the failed query settle (retry:false → straight to error).
		await waitFor(() =>
			expect(calls.some((c) => c.path === "/api/projects")).toBe(true),
		);
		// Give the redirect effect time to (wrongly) fire, then assert it never did.
		await new Promise((r) => setTimeout(r, 30));
		expect(routerReplace).not.toHaveBeenCalledWith("/onboarding");
	});

	it("DOES redirect a genuinely-empty workspace (successful fetch, zero projects) to /onboarding", async () => {
		vi.mocked(api).mockImplementation(async (path: string, opts = {}) => {
			calls.push({ path, method: opts.method ?? "GET" });
			if (path === "/api/projects") return { projects: [] };
			if (path === "/api/tags") return { tags: tagsState };
			return {};
		});
		renderInbox();
		await waitFor(() =>
			expect(routerReplace).toHaveBeenCalledWith("/onboarding"),
		);
	});
});
