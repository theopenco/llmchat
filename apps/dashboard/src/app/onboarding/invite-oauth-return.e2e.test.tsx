// Through-the-pages test of the OAuth invite carry, mirroring the confirmed
// field repro: fresh account → invite link → sign-up page → "Continue with
// Google" → returns authenticated at /onboarding with the invite still
// pending. The query param the email path rides is dropped by the hosted
// flow's fixed callbackURL, so the REAL sign-up page must write the
// sessionStorage stash on the click, and the REAL onboarding page's boot
// check must consume it and leave for /invite/<tok> instead of the paywall.
//
// Real here: SignUpPage, OAuthButtons, startSocialSignIn, the stash helpers,
// OnboardingPage and its boot check. Stubbed: the Better Auth client (the
// provider redirect itself), fetch, the router, and onboarding's data hooks.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { planEntitlements } from "@llmchat/shared";

import { track } from "@/lib/analytics";
import { useSession } from "@/lib/auth-client";
import { fetchUsage } from "@/lib/billing";
import { PENDING_INVITE_KEY } from "@/lib/invite-return";
import { useOnboardingState } from "@/lib/use-onboarding";

import OnboardingPage from "./page";
import SignUpPage from "../sign-up/page";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push, replace }),
	useSearchParams: () => searchParams,
}));
vi.mock("sonner", () => ({
	toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/analytics", () => ({
	ANALYTICS_EVENTS: {
		signupCompleted: "signup_completed",
		signedIn: "signed_in",
		onboardingStarted: "onboarding_started",
		onboardingCompleted: "onboarding_completed",
		projectCreated: "project_created",
	},
	track: vi.fn(),
}));
// The Better Auth client is the one boundary stubbed on the sign-up side:
// authClient.signIn.social is where the browser would leave for Google.
const socialSignIn = vi.fn();
vi.mock("@/lib/auth-client", () => ({
	useSession: vi.fn(),
	signIn: { email: vi.fn(), social: vi.fn() },
	signUp: { email: vi.fn() },
	signOut: vi.fn(() => Promise.resolve()),
	authClient: {
		signIn: { social: (...args: unknown[]) => socialSignIn(...args) },
	},
}));
// Onboarding's data hooks, as in its page tests — the journey under test is
// the stash+boot layer, which must preempt all of this.
vi.mock("@/lib/use-onboarding", () => ({ useOnboardingState: vi.fn() }));
vi.mock("@/lib/billing", () => ({
	fetchUsage: vi.fn(),
	startCheckout: vi.fn(),
	redirectToStripeCheckout: vi.fn(),
	isBillingNotConfigured: vi.fn(() => false),
}));
vi.mock("@llmchat/widget/styles", () => ({ widgetStyles: "" }));
vi.mock("@llmchat/widget/chat", () => ({
	WidgetFrame: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	MessageList: ({ greeting }: { greeting: string }) => <p>{greeting}</p>,
}));

function stubProvidersFetch() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ google: true, github: true }),
			text: async () => "",
		})),
	);
}

function mount(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>{ui}</QueryClientProvider>,
	);
}

/** Click "Continue with Google" on the real sign-up page. */
async function startGoogleSignUp() {
	const u = userEvent.setup();
	const button = await screen.findByRole("button", {
		name: /continue with google/i,
	});
	await waitFor(() => expect(button).toBeEnabled());
	await u.click(button);
	await waitFor(() => expect(socialSignIn).toHaveBeenCalled());
}

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
	localStorage.clear();
	searchParams = new URLSearchParams();
	socialSignIn.mockResolvedValue({});
	stubProvidersFetch();
	// Signed out by default (the sign-up page); the OAuth-return phase flips it.
	vi.mocked(useSession).mockReturnValue({
		data: null,
		isPending: false,
	} as ReturnType<typeof useSession>);
	vi.mocked(useOnboardingState).mockReturnValue({
		state: "needs-onboarding",
		workspaceId: "wsPersonal",
	});
	vi.mocked(fetchUsage).mockResolvedValue({
		plan: "none",
		exempt: false,
		entitlements: planEntitlements("none"),
		usage: { projects: 0, members: 1, responsesThisMonth: 0 },
		availablePlans: ["starter", "growth", "scale"],
		monthStartUnix: 0,
	});
});

describe("invite carry across the OAuth round-trip (field repro)", () => {
	it("sign-up ?invite= → Continue with Google → authenticated /onboarding boots to the invitation, not the paywall", async () => {
		// ── Phase 1: the invitee, bounced from /invite/tok_oauth, is on the
		// sign-up page with the invite in the URL and picks Google.
		searchParams = new URLSearchParams("invite=tok_oauth");
		mount(<SignUpPage />);
		await startGoogleSignUp();

		// The click stashed the token for the round-trip; the OAuth flow still
		// returns to the fixed /onboarding entry point, and the ERROR return
		// keeps carrying the invite in its URL (the retry path depends on it).
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBe("tok_oauth");
		expect(socialSignIn).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "google",
				callbackURL: expect.stringMatching(/\/onboarding$/),
				errorCallbackURL: expect.stringContaining("invite=tok_oauth"),
			}),
		);

		// ── The OAuth round-trip: leaves for Google, returns authenticated at
		// /onboarding with NO query params — only the stash survives. The
		// personal workspace has been auto-provisioned server-side meanwhile.
		cleanup();
		searchParams = new URLSearchParams();
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "u1", email: "iva@example.com" } },
			isPending: false,
		} as ReturnType<typeof useSession>);

		// ── Phase 2: the boot check consumes the stash and leaves for the
		// invitation. Before the fix this rendered the paywall with the invite
		// still pending — the field repro's dead end.
		mount(<OnboardingPage />);
		await waitFor(() =>
			expect(replace).toHaveBeenCalledWith("/invite/tok_oauth"),
		);
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull(); // consumed

		// The banner renders in that state: the hand-off notice with a manual
		// path to the invitation — never the paywall.
		expect(
			screen.getByRole("heading", { name: /you've been invited/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /open your invitation/i }),
		).toHaveAttribute("href", "/invite/tok_oauth");
		expect(
			screen.queryByRole("heading", { name: /choose a plan/i }),
		).not.toBeInTheDocument();

		// An invite pass-through is not an onboarding start — the funnel event
		// must not fire.
		expect(track).not.toHaveBeenCalledWith("onboarding_started");
	});

	it("a returning (already-onboarded) invitee goes to the invitation, not /inbox — the ready-bounce yields", async () => {
		// Their OAuth return: stash present (set on the sign-in page's Google
		// click), session live, onboarding state already "ready".
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_ready");
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "u2", email: "owner@example.com" } },
			isPending: false,
		} as ReturnType<typeof useSession>);
		vi.mocked(useOnboardingState).mockReturnValue({
			state: "ready",
			workspaceId: "wsExisting",
		});

		mount(<OnboardingPage />);
		await waitFor(() =>
			expect(replace).toHaveBeenCalledWith("/invite/tok_ready"),
		);
		// The last replace() wins in a browser — /inbox must never fire, or the
		// invitation is stranded unaccepted with its stash already consumed.
		expect(replace).not.toHaveBeenCalledWith("/inbox");
	});

	it("a plain Google sign-up (no invite in the URL) clears a stale stash instead of being hijacked by it", async () => {
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_stale");
		searchParams = new URLSearchParams();
		mount(<SignUpPage />);
		await startGoogleSignUp();

		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
		// And no phantom invite is planted on the error return either.
		expect(vi.mocked(socialSignIn).mock.calls[0][0]).toMatchObject({
			errorCallbackURL: expect.not.stringContaining("invite="),
		});
	});

	it("an OAuth error return keeps the invite for the retry — the retry click re-stashes instead of wiping", async () => {
		// First attempt from the sign-up page with the invite in the URL.
		searchParams = new URLSearchParams("invite=tok_oauth");
		mount(<SignUpPage />);
		await startGoogleSignUp();
		const firstCall = vi.mocked(socialSignIn).mock.calls[0][0] as {
			errorCallbackURL: string;
		};

		// Google denies/cancels: Better Auth returns to the errorCallbackURL the
		// impl built. The retry page's query is derived from THAT URL — if the
		// impl drops the invite there, the retry below wipes the stash.
		cleanup();
		searchParams = new URL(firstCall.errorCallbackURL).searchParams;
		socialSignIn.mockClear();
		mount(<SignUpPage />);
		await startGoogleSignUp();

		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBe("tok_oauth");
	});

	it("new-bot mode (?new=1) ignores the stash: no yank to the invitation, stash left intact", async () => {
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_newbot");
		searchParams = new URLSearchParams("new=1");
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: "u3", email: "owner@example.com" } },
			isPending: false,
		} as ReturnType<typeof useSession>);
		vi.mocked(useOnboardingState).mockReturnValue({
			state: "ready",
			workspaceId: "wsExisting",
		});

		mount(<OnboardingPage />);
		// The explicit add-another-agent flow renders; the stash is neither
		// consumed nor acted on.
		expect(
			await screen.findByRole("heading", {
				name: /add another support agent/i,
			}),
		).toBeInTheDocument();
		expect(replace).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("heading", { name: /you've been invited/i }),
		).not.toBeInTheDocument();
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBe("tok_newbot");
	});

	it("an unauthenticated arrival with a stash converts it into the sign-in query param (nothing strands)", async () => {
		sessionStorage.setItem(PENDING_INVITE_KEY, "tok_unauth");
		// Signed out (the beforeEach default) — e.g. the OAuth return came back
		// without a session.
		mount(<OnboardingPage />);

		await waitFor(() =>
			expect(replace).toHaveBeenCalledWith("/sign-in?invite=tok_unauth"),
		);
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
	});
});
