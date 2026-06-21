// Through-the-dialog tests: the REAL WorkspacesSettingsPage + REAL Create/Delete
// dialogs + REAL WorkspaceProvider + REAL api()/fetch (only window.fetch and the
// router are stubbed). This exercises the button → fetch path end to end — the
// gap that let a dead destructive button ship past a mocked-`api` test. It
// asserts the DELETE/POST actually fire, that clicking confirm does NOT close the
// delete dialog (the AlertDialogAction auto-close regression), that deleting the
// current workspace switches context, and that the blocked states gate the
// request entirely.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";
import type { Plan, WorkspaceRole } from "@/lib/workspace-utils";

import WorkspacesSettingsPage from "./page";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

const push = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// NOTE: @/lib/api is NOT mocked — the real api()/fetch path is exercised.

const KEY = "llmchat_workspace_id";

interface WS {
	id: string;
	name: string;
	plan: Plan;
	role: WorkspaceRole;
}

function jsonRes(body: unknown) {
	return {
		ok: true,
		status: 200,
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

let fetchMock: ReturnType<typeof vi.fn>;
/** Resolve the in-flight DELETE on demand so we can observe the pending (dialog
 * stays open) state. */
let resolveDelete: (v: unknown) => void;

function stubFetch(workspaces: WS[]) {
	fetchMock = vi.fn((url: string, init: { method?: string } = {}) => {
		const method = init.method ?? "GET";
		if (url.includes("/api/workspaces") && method === "DELETE") {
			return new Promise((res) => {
				resolveDelete = () => res(jsonRes({ ok: true }));
			});
		}
		if (url.includes("/api/workspaces") && method === "POST") {
			return Promise.resolve(
				jsonRes({ workspace: { id: "wsNew", name: "New" } }),
			);
		}
		// GET /api/workspaces — the provider's list.
		return Promise.resolve(
			jsonRes({
				workspaces: workspaces.map((w) => ({
					workspace: { id: w.id, name: w.name, plan: w.plan },
					role: w.role,
				})),
			}),
		);
	});
	vi.stubGlobal("fetch", fetchMock);
}

function renderPage(current = "ws1") {
	localStorage.setItem(KEY, current);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<WorkspaceProvider>
				<WorkspacesSettingsPage />
			</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

const callsFor = (method: string) =>
	fetchMock.mock.calls.filter(
		([url, init]) =>
			String(url).includes("/api/workspaces") &&
			(init?.method ?? "GET") === method,
	);

beforeEach(() => {
	push.mockClear();
	localStorage.clear();
});

const TWO: WS[] = [
	{ id: "ws1", name: "Acme", plan: "none", role: "owner" },
	{ id: "ws2", name: "Globex", plan: "none", role: "owner" },
];

describe("WorkspacesSettingsPage", () => {
	it("lists the workspaces and marks the current one", async () => {
		stubFetch(TWO);
		renderPage("ws1");

		const acme = await screen.findByText("Acme");
		expect(acme).toBeInTheDocument();
		expect(screen.getByText("Globex")).toBeInTheDocument();
		// The current workspace carries a "Current" badge; the other shows "Switch".
		expect(screen.getByText("Current")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Switch" })).toBeInTheDocument();
	});

	it("deleting the CURRENT workspace fires DELETE, keeps the dialog open while pending, then switches context", async () => {
		const user = userEvent.setup();
		stubFetch(TWO);
		renderPage("ws1");
		await screen.findByText("Acme");

		// Open the delete dialog for the current workspace (Acme / ws1).
		const acmeRow = screen.getByText("Acme").closest("li")!;
		await user.click(within(acmeRow).getByRole("button", { name: "Delete" }));

		const dialog = await screen.findByRole("alertdialog");
		await user.type(
			within(dialog).getByLabelText("Confirm workspace name"),
			"Acme",
		);
		await user.click(
			within(dialog).getByRole("button", { name: /delete workspace/i }),
		);

		// A real DELETE /api/workspaces/ws1 fired…
		await waitFor(() => expect(callsFor("DELETE").length).toBe(1));
		expect(String(callsFor("DELETE")[0]![0])).toContain("/api/workspaces/ws1");

		// …and the dialog did NOT close on click — it stays open showing "Deleting…"
		// while the request is in flight (the AlertDialogAction auto-close regression).
		expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		expect(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: /deleting/i,
			}),
		).toBeInTheDocument();

		// Resolve the delete → context switches to the remaining workspace (ws2).
		resolveDelete(undefined);
		await waitFor(() => expect(localStorage.getItem(KEY)).toBe("ws2"));
	});

	it("creating a workspace POSTs the name and routes to onboarding", async () => {
		const user = userEvent.setup();
		stubFetch(TWO);
		renderPage("ws1");
		await screen.findByText("Acme");

		await user.click(screen.getByRole("button", { name: /create workspace/i }));
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Name"), "Initech");
		await user.click(
			within(dialog).getByRole("button", { name: /create workspace/i }),
		);

		await waitFor(() => expect(callsFor("POST").length).toBe(1));
		expect(JSON.parse(callsFor("POST")[0]![1].body)).toEqual({
			name: "Initech",
		});
		await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
	});

	it("blocks deleting the user's LAST workspace — guard message, no name field, no request", async () => {
		const user = userEvent.setup();
		stubFetch([TWO[0]!]); // only one workspace
		renderPage("ws1");
		await screen.findByText("Acme");

		const acmeRow = screen.getByText("Acme").closest("li")!;
		await user.click(within(acmeRow).getByRole("button", { name: "Delete" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(/only workspace/i)).toBeInTheDocument();
		// No confirm path at all — the destructive button + name field are hidden.
		expect(
			within(dialog).queryByLabelText("Confirm workspace name"),
		).not.toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: /delete workspace/i }),
		).not.toBeInTheDocument();
		expect(callsFor("DELETE").length).toBe(0);
	});

	it("blocks deleting a workspace with an active subscription — cancel-first guidance, no request", async () => {
		const user = userEvent.setup();
		stubFetch([
			{ id: "ws1", name: "Acme", plan: "none", role: "owner" },
			{ id: "ws2", name: "Globex", plan: "growth", role: "owner" },
		]);
		renderPage("ws1");
		await screen.findByText("Globex");

		const globexRow = screen.getByText("Globex").closest("li")!;
		await user.click(within(globexRow).getByRole("button", { name: "Delete" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(/active subscription/i),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: /go to billing/i }),
		).toBeInTheDocument();
		expect(
			within(dialog).queryByRole("button", { name: /delete workspace/i }),
		).not.toBeInTheDocument();
		expect(callsFor("DELETE").length).toBe(0);
	});
});

// ─── refresh after deleting the current workspace ─────────────────────────────
// The concern: after deleting the workspace you're in, a page refresh must NOT
// re-activate the deleted workspace (which would 400/403 every per-workspace
// request). Two independent guarantees protect this — (1) delete-current
// persists the new selection to localStorage, and (2) even a stale persisted id
// self-heals via resolveWorkspaceId. These tests prove BOTH survive an actual
// remount (a fresh QueryClient = a real page refresh, with the deleted workspace
// gone from the server's list).

/** Surfaces the provider's resolved active workspace so a refresh can be asserted. */
function ActiveWorkspaceProbe() {
	const { workspaceId, isLoading } = useWorkspace();
	return (
		<div data-testid="active-ws">
			{isLoading ? "loading" : (workspaceId ?? "none")}
		</div>
	);
}

/** GET /api/workspaces returns whatever `getList()` yields at call time, so the
 * post-delete refresh can serve a list with the deleted workspace removed. */
function stubFetchDynamic(getList: () => WS[]) {
	fetchMock = vi.fn((url: string, init: { method?: string } = {}) => {
		const method = init.method ?? "GET";
		if (url.includes("/api/workspaces") && method === "DELETE") {
			return new Promise((res) => {
				resolveDelete = () => res(jsonRes({ ok: true }));
			});
		}
		return Promise.resolve(
			jsonRes({
				workspaces: getList().map((w) => ({
					workspace: { id: w.id, name: w.name, plan: w.plan },
					role: w.role,
				})),
			}),
		);
	});
	vi.stubGlobal("fetch", fetchMock);
}

/** Mount just the provider + probe with a fresh cache — i.e. a page refresh. */
function refresh() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<WorkspaceProvider>
				<ActiveWorkspaceProbe />
			</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

describe("refresh after deleting the current workspace", () => {
	it("persists the new selection — a refresh loads the surviving workspace, never the deleted one", async () => {
		const user = userEvent.setup();
		let list: WS[] = [...TWO]; // ws1 (current) + ws2
		stubFetchDynamic(() => list);

		const first = renderPage("ws1");
		await screen.findByText("Acme");

		// Delete the current workspace (ws1).
		const acmeRow = screen.getByText("Acme").closest("li")!;
		await user.click(within(acmeRow).getByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.type(
			within(dialog).getByLabelText("Confirm workspace name"),
			"Acme",
		);
		await user.click(
			within(dialog).getByRole("button", { name: /delete workspace/i }),
		);
		await waitFor(() => expect(callsFor("DELETE").length).toBe(1));
		resolveDelete(undefined);
		await waitFor(() => expect(localStorage.getItem(KEY)).toBe("ws2"));

		// The server no longer has ws1; refresh the app.
		list = [TWO[1]!]; // only ws2 survives
		first.unmount();
		refresh();

		// The provider activates the surviving workspace, never the deleted ws1.
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("ws2"),
		);
		expect(screen.getByTestId("active-ws")).not.toHaveTextContent("ws1");
	});

	it("self-heals a stale persisted id — even if localStorage still points at the deleted workspace, a refresh resolves a valid one", async () => {
		// Belt-and-suspenders: simulate the persisted selection somehow still being
		// the deleted id on refresh (the resolveWorkspaceId backstop, unit-tested in
		// workspace-utils.test.ts at the integration level here).
		localStorage.setItem(KEY, "ws1"); // the now-deleted workspace
		stubFetchDynamic(() => [TWO[1]!]); // server only returns ws2

		refresh();

		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("ws2"),
		);
		expect(screen.getByTestId("active-ws")).not.toHaveTextContent("ws1");
	});
});
