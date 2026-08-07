// Through-the-page tests: the REAL AcceptInvitePage + REAL WorkspaceProvider +
// REAL api()/fetch (only window.fetch, the session hook, and the router are
// stubbed). Pins the first-run bug: after accepting an invite the JOINED
// workspace must be the active one — before the fix, the provider's reconcile
// effect validated the fresh selection against the STALE cached workspace list
// and demoted it back to the invitee's auto-provisioned personal workspace,
// stranding them on the onboarding paywall.

import {
	QueryClient,
	QueryClientProvider,
	useQueryClient,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_INVITE_KEY } from "@/lib/invite-return";
import { useOnboardingRedirect } from "@/lib/use-onboarding-redirect";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";
import { WORKSPACE_STORAGE_KEY as KEY } from "@/lib/workspace-utils";

import AcceptInvitePage from "./page";

const replace = vi.fn();
let pathname = "/invite/tok_test";
vi.mock("next/navigation", () => ({
	useParams: () => ({ token: "tok_test" }),
	useRouter: () => ({ replace, push: vi.fn() }),
	usePathname: () => pathname,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({
	ANALYTICS_EVENTS: { inviteAccepted: "invite_accepted" },
	track: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
	useSession: () => ({
		data: { user: { email: "iva@example.com" } },
		isPending: false,
	}),
}));
// NOTE: @/lib/api is NOT mocked — the real api()/fetch path is exercised.

// jsdom's window.location is not spy-able; swap in a minimal stand-in so the
// hard navigation is observable.
const assign = vi.fn();
beforeAll(() => {
	Object.defineProperty(window, "location", {
		value: { ...window.location, assign },
		writable: true,
	});
});

// The invitee's server state: their auto-provisioned personal workspace, and —
// once `accepted` flips — the workspace the invite joined them to.
const PERSONAL = {
	workspace: { id: "wsPersonal", name: "Iva's Workspace", plan: "none" },
	role: "owner",
	projectCount: 0,
};
const JOINED = {
	workspace: { id: "wsJoined", name: "Acme Tools", plan: "growth" },
	role: "agent",
	projectCount: 2,
};

let accepted: boolean;
/** When set, every GET /api/workspaces AFTER the accept fails — simulates the
 * post-accept refetch dying so the provisional cache row is the only thing
 * keeping the stored selection resolvable. */
let failListAfterAccept: boolean;

function jsonRes(body: unknown, status = 200) {
	return {
		ok: status < 400,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

let fetchMock: ReturnType<typeof vi.fn>;
function stubFetch() {
	fetchMock = vi.fn(
		(url: string, init: { method?: string; headers?: unknown } = {}) => {
			const method = init.method ?? "GET";
			if (url.includes("/api/invites/preview") && method === "POST") {
				return Promise.resolve(
					jsonRes({
						workspaceName: "Acme Tools",
						role: "agent",
						email: "iva@example.com",
						inviterName: "Omar",
					}),
				);
			}
			if (url.includes("/api/invites/accept") && method === "POST") {
				accepted = true;
				return Promise.resolve(jsonRes({ workspaceId: "wsJoined" }));
			}
			if (url.includes("/api/workspaces")) {
				if (accepted && failListAfterAccept) {
					return Promise.resolve(jsonRes({ error: "boom" }, 500));
				}
				return Promise.resolve(
					jsonRes({ workspaces: accepted ? [PERSONAL, JOINED] : [PERSONAL] }),
				);
			}
			if (url.includes("/api/projects")) {
				const ws = (init.headers as Record<string, string> | undefined)?.[
					"x-workspace-id"
				];
				return Promise.resolve(
					jsonRes({ projects: ws === "wsJoined" ? [{ id: "p1" }] : [] }),
				);
			}
			return Promise.resolve(jsonRes({}, 404));
		},
	);
	vi.stubGlobal("fetch", fetchMock);
}

function Probe() {
	const { workspaceId } = useWorkspace();
	return <div data-testid="active-ws">{workspaceId}</div>;
}

/** Selects a workspace the cached list doesn't know while invalidating it —
 * the raw sequence an invite accept performs, minus the page's cache patch. */
function JoinHarness() {
	const { setWorkspaceId } = useWorkspace();
	const qc = useQueryClient();
	return (
		<button
			onClick={() => {
				void qc.invalidateQueries({ queryKey: ["workspaces"] });
				setWorkspaceId("wsJoined");
			}}
		>
			join
		</button>
	);
}

/** A stand-in for any gated page (/settings, /inbox): runs the REAL
 * onboarding-redirect hook against the REAL provider state. */
function GatedProbe() {
	useOnboardingRedirect(true);
	return <Probe />;
}

function mount(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<WorkspaceProvider>{ui}</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	accepted = false;
	failListAfterAccept = false;
	assign.mockClear();
	replace.mockClear();
	pathname = "/invite/tok_test";
	localStorage.clear();
	sessionStorage.clear();
	localStorage.setItem(KEY, "wsPersonal");
	stubFetch();
});

describe("invite accept — the joined workspace stays active", () => {
	it("accept selects the joined workspace and it SURVIVES the provider's reconcile", async () => {
		const user = userEvent.setup();
		mount(
			<>
				<AcceptInvitePage />
				<Probe />
			</>,
		);

		await user.click(
			await screen.findByRole("button", { name: /accept invitation/i }),
		);
		await waitFor(() => expect(assign).toHaveBeenCalledWith("/inbox"));

		// The regression pin: before the fix, the reconcile effect demoted both
		// the stored id and the context back to wsPersonal at this point.
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");

		// And it stays once the authoritative refetch lands.
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.filter(([u]) =>
					String(u).includes("/api/workspaces"),
				).length,
			).toBeGreaterThanOrEqual(2),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
		expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined");
	});

	it("keeps the joined workspace even when the post-accept list refetch FAILS", async () => {
		failListAfterAccept = true;
		const user = userEvent.setup();
		mount(
			<>
				<AcceptInvitePage />
				<Probe />
			</>,
		);

		await user.click(
			await screen.findByRole("button", { name: /accept invitation/i }),
		);
		await waitFor(() => expect(assign).toHaveBeenCalledWith("/inbox"));

		// The invalidation refetch 500s (retry: false), so the provisional cache
		// row is the only thing validating the stored id — it must hold.
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.filter(([u]) =>
					String(u).includes("/api/workspaces"),
				).length,
			).toBeGreaterThanOrEqual(2),
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
	});

	it("a fresh load after accepting (reload / hard navigation) resolves to the joined workspace", async () => {
		accepted = true; // server truth now includes the membership
		localStorage.setItem(KEY, "wsJoined"); // what accept persisted
		mount(<Probe />);

		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
	});

	it("a gated page after accepting does NOT bounce to /onboarding", async () => {
		accepted = true;
		localStorage.setItem(KEY, "wsJoined");
		pathname = "/settings/projects";
		mount(<GatedProbe />);

		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		// Let the projects query settle before asserting the redirect never fired.
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(([u]) => String(u).includes("/api/projects")),
			).toBe(true),
		);
		expect(replace).not.toHaveBeenCalledWith("/onboarding");
	});

	it("sanity: the same gate DOES bounce an empty personal workspace (guards a vacuous pass)", async () => {
		accepted = true;
		localStorage.setItem(KEY, "wsPersonal");
		pathname = "/settings/projects";
		mount(<GatedProbe />);

		await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
	});

	it("provider guard alone: a selection missing from the list is NOT demoted while a refetch is in flight", async () => {
		// Exercises shouldDeferDemotion in the provider without the invite page's
		// cache patch: select an id the cached list doesn't know while the list
		// query is refetching — the demotion must wait for the fresh list.
		let resolveSecond: ((v: unknown) => void) | undefined;
		let call = 0;
		fetchMock = vi.fn((url: string) => {
			if (String(url).includes("/api/workspaces")) {
				call += 1;
				if (call === 1) {
					return Promise.resolve(jsonRes({ workspaces: [PERSONAL] }));
				}
				return new Promise((res) => {
					resolveSecond = () =>
						res(jsonRes({ workspaces: [PERSONAL, JOINED] }));
				});
			}
			return Promise.resolve(jsonRes({}, 404));
		});
		vi.stubGlobal("fetch", fetchMock);

		const user = userEvent.setup();
		mount(
			<>
				<JoinHarness />
				<Probe />
			</>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsPersonal"),
		);

		await user.click(screen.getByRole("button", { name: "join" }));
		// Refetch is hanging: without the guard, reconcile would demote to
		// wsPersonal right here against the stale [PERSONAL] list.
		await waitFor(() => expect(resolveSecond).toBeDefined());
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
		expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined");

		resolveSecond!(undefined);
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
	});

	it("arriving clears a stash of the SAME token — the query-param path carries it now", async () => {
		// e.g. this tab stashed the token for an OAuth attempt that was abandoned;
		// without the clear, the stash would go stale on accept and hijack a
		// later /onboarding visit.
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_test");
		mount(<AcceptInvitePage />);

		await screen.findByRole("button", { name: /accept invitation/i });
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
	});

	it("arriving leaves a DIFFERENT token's stash alone (a separate pending carry)", async () => {
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_other");
		mount(<AcceptInvitePage />);

		await screen.findByRole("button", { name: /accept invitation/i });
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBe("tok_other");
	});

	it("owner regression: a genuinely stale stored id is still demoted to a sensible default", async () => {
		accepted = true;
		localStorage.setItem(KEY, "wsDeletedLongAgo");
		mount(<Probe />);

		// pickDefaultWorkspace prefers the non-empty workspace.
		await waitFor(() =>
			expect(screen.getByTestId("active-ws")).toHaveTextContent("wsJoined"),
		);
		expect(localStorage.getItem(KEY)).toBe("wsJoined");
	});
});
