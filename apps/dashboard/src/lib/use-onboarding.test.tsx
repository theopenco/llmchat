import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import { useOnboardingState } from "./use-onboarding";

// useOnboardingState backs the onboarding page guard AND (via the shared
// resolveOnboardingState) the inbox redirect. The sharp bug: a FAILED
// `/api/projects` fetch reports projectCount:0 with loading:false — identical to
// a genuinely empty workspace — so it would conclude "needs-onboarding" and
// bounce a paying customer into onboarding (risking a duplicate workspace). The
// fix threads the query's isSuccess in, so only a SUCCESSFUL empty fetch counts.

let workspaceState: {
	workspaces: { id: string }[];
	workspaceId: string | null;
	isLoading: boolean;
};
vi.mock("@/lib/workspace", () => ({ useWorkspace: () => workspaceState }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));

function setup() {
	// retry:false so a rejected fetch settles straight to `error` (no backoff),
	// and a fresh client per test so query state never leaks between cases.
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const wrapper = ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client }, children);
	const { result } = renderHook(() => useOnboardingState(), { wrapper });
	return { client, result };
}

beforeEach(() => {
	workspaceState = {
		workspaces: [{ id: "ws1" }],
		workspaceId: "ws1",
		isLoading: false,
	};
});
afterEach(() => vi.clearAllMocks());

describe("useOnboardingState", () => {
	it("does NOT report needs-onboarding when the projects fetch FAILS (no false bounce)", async () => {
		vi.mocked(api).mockRejectedValue(new Error("network down"));
		const { client, result } = setup();

		// Wait until the query has genuinely SETTLED into error — only then is the
		// distinction meaningful (the buggy code concluded needs-onboarding here).
		await waitFor(() =>
			expect(client.getQueryState(["projects", "ws1"])?.status).toBe("error"),
		);

		expect(result.current.state).not.toBe("needs-onboarding");
		// Holds in a loading state rather than bouncing — mirrors the redirect
		// hook's "do nothing on non-success".
		expect(result.current.state).toBe("loading");
	});

	it("reports needs-onboarding only from a SUCCESSFUL empty fetch", async () => {
		vi.mocked(api).mockResolvedValue({ projects: [] });
		const { result } = setup();
		await waitFor(() => expect(result.current.state).toBe("needs-onboarding"));
	});

	it("reports ready when a successful fetch returns projects", async () => {
		vi.mocked(api).mockResolvedValue({ projects: [{ id: "p1" }] });
		const { result } = setup();
		await waitFor(() => expect(result.current.state).toBe("ready"));
	});

	it("reports needs-onboarding for a brand-new user with no workspace", async () => {
		workspaceState = { workspaces: [], workspaceId: null, isLoading: false };
		const { result } = setup();
		// No workspace at all → onboarding, independent of the projects fetch
		// (which is disabled without a workspace id).
		await waitFor(() => expect(result.current.state).toBe("needs-onboarding"));
		expect(api).not.toHaveBeenCalled();
	});
});
