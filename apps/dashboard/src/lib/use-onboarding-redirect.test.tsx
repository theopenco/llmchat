import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnboardingRedirect } from "./use-onboarding-redirect";

const replace = vi.fn();
let pathname = "/inbox";
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace }),
	usePathname: () => pathname,
}));

let workspaceState: {
	workspaces: { id: string }[];
	workspaceId: string | null;
	isLoading: boolean;
};
vi.mock("@/lib/workspace", () => ({ useWorkspace: () => workspaceState }));

// The projects query returns an empty list, so a no-project user would be sent
// to onboarding on a non-escape route.
vi.mock("@/lib/api", () => ({ api: vi.fn(async () => ({ projects: [] })) }));

function wrapper({ children }: { children: ReactNode }) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
	replace.mockClear();
	localStorage.clear();
	pathname = "/inbox";
	workspaceState = {
		workspaces: [{ id: "ws1" }],
		workspaceId: "ws1",
		isLoading: false,
	};
});
afterEach(() => vi.clearAllMocks());

describe("useOnboardingRedirect", () => {
	it("redirects a no-project user to /onboarding from a normal route", async () => {
		pathname = "/inbox";
		renderHook(() => useOnboardingRedirect(true), { wrapper });
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
	});

	it("redirects a brand-new (no-workspace) user to /onboarding", async () => {
		workspaceState = { workspaces: [], workspaceId: null, isLoading: false };
		renderHook(() => useOnboardingRedirect(true), { wrapper });
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
	});

	it("does NOT bounce a no-plan user off /settings/account (the escape hatch)", async () => {
		pathname = "/settings/account";
		renderHook(() => useOnboardingRedirect(true), { wrapper });
		// Give the effect + the projects query time to resolve, then assert no bounce.
		await new Promise((r) => setTimeout(r, 20));
		expect(replace).not.toHaveBeenCalled();
	});

	it("does NOT bounce a no-plan user off /settings/billing", async () => {
		pathname = "/settings/billing";
		renderHook(() => useOnboardingRedirect(true), { wrapper });
		await new Promise((r) => setTimeout(r, 20));
		expect(replace).not.toHaveBeenCalled();
	});

	it("does not redirect even a brand-new user away from the escape routes", async () => {
		workspaceState = { workspaces: [], workspaceId: null, isLoading: false };
		pathname = "/settings/account";
		renderHook(() => useOnboardingRedirect(true), { wrapper });
		await new Promise((r) => setTimeout(r, 20));
		expect(replace).not.toHaveBeenCalled();
	});

	it("is inert when disabled", async () => {
		renderHook(() => useOnboardingRedirect(false), { wrapper });
		await new Promise((r) => setTimeout(r, 20));
		expect(replace).not.toHaveBeenCalled();
	});
});
