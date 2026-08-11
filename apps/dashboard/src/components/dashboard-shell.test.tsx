// The client auth gate is the single choke point every perceived "signed out"
// funnels through (in prod the SSR can never see the api-origin cookie, so
// this gate is always the arbiter). Better Auth's focus/online refetch nulls
// its session store on ANY failed get-session — a 429 rate-limit blip, a 5xx —
// so the gate must distinguish transient failures (hold, skeleton, let the
// next refetch decide) from definitive sign-outs (clean 200-null or 401).
// Before this distinction, every blip bounced a validly-cookied user to
// /sign-in: the auto-sign-out bug.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@/lib/auth-client";

import { DashboardShell } from "./dashboard-shell";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace }),
}));
vi.mock("@/lib/auth-client", async (orig) => ({
	// Keep the REAL isTransientSessionError — the gate's behavior under test IS
	// its composition with that predicate.
	...(await orig<typeof import("@/lib/auth-client")>()),
	useSession: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => ({ role: null }),
}));
vi.mock("@/lib/use-onboarding-redirect", () => ({
	useOnboardingRedirect: vi.fn(),
}));
vi.mock("@/components/dashboard-skeleton", () => ({
	DashboardSkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/shell/command-palette", () => ({
	CommandPalette: () => null,
}));
vi.mock("@/components/shell/top-bar", () => ({ TopBar: () => null }));
vi.mock("@/components/shell/sidebar-nav", () => ({ SidebarNav: () => null }));
vi.mock("@/components/launch-banner", () => ({ LaunchBanner: () => null }));
vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
	SheetContent: ({ children }: { children?: React.ReactNode }) => (
		<>{children}</>
	),
	SheetTitle: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/use-selected-project", () => ({
	SelectedProjectProvider: ({ children }: { children?: React.ReactNode }) => (
		<>{children}</>
	),
}));

function mockSession(state: {
	data?: { user: { email: string } } | null;
	isPending?: boolean;
	error?: { status?: number } | null;
}) {
	vi.mocked(useSession).mockReturnValue({
		data: state.data ?? null,
		isPending: state.isPending ?? false,
		error: state.error ?? null,
	} as never);
}

beforeEach(() => {
	replace.mockClear();
});

describe("DashboardShell auth gate", () => {
	it("redirects to /sign-in on a definitive no-session (clean 200-null)", () => {
		mockSession({ data: null, error: null });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).toHaveBeenCalledWith("/sign-in");
	});

	it("redirects to /sign-in on a definitive 401", () => {
		mockSession({ data: null, error: { status: 401 } });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).toHaveBeenCalledWith("/sign-in");
	});

	it("HOLDS on a transient 429 — skeleton, no redirect (a rate-limit blip is not a sign-out)", () => {
		mockSession({ data: null, error: { status: 429 } });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).not.toHaveBeenCalled();
		expect(screen.getByTestId("skeleton")).toBeDefined();
	});

	it("HOLDS on a transient 5xx — skeleton, no redirect", () => {
		mockSession({ data: null, error: { status: 502 } });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).not.toHaveBeenCalled();
		expect(screen.getByTestId("skeleton")).toBeDefined();
	});

	it("never gates when the server already confirmed the session (initialEmail)", () => {
		mockSession({ data: null, error: { status: 429 } });
		render(
			<DashboardShell initialEmail="omar@example.com">child</DashboardShell>,
		);
		expect(replace).not.toHaveBeenCalled();
		expect(screen.getByText("child")).toBeDefined();
	});

	it("renders children for a resolved session", () => {
		mockSession({ data: { user: { email: "omar@example.com" } } });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).not.toHaveBeenCalled();
		expect(screen.getByText("child")).toBeDefined();
	});

	it("shows the skeleton while the session is still resolving", () => {
		mockSession({ data: null, isPending: true });
		render(<DashboardShell>child</DashboardShell>);
		expect(replace).not.toHaveBeenCalled();
		expect(screen.getByTestId("skeleton")).toBeDefined();
	});
});
