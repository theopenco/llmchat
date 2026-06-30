import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signIn } from "@/lib/auth-client";

import SignInPage from "./page";

vi.mock("@/lib/auth-client", () => ({
	signIn: { email: vi.fn() },
	sendVerificationEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/analytics", () => ({
	track: vi.fn(),
	ANALYTICS_EVENTS: { signedIn: "signed_in" },
}));
vi.mock("@/lib/oauth", () => ({
	fetchOAuthProviders: vi.fn(async () => ({ google: false, github: false })),
	startSocialSignIn: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<SignInPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("SignInPage — unverified email", () => {
	it("shows the inline verify notice + resend when sign-in returns EMAIL_NOT_VERIFIED (403)", async () => {
		vi.mocked(signIn.email).mockResolvedValue({
			data: null,
			error: {
				code: "EMAIL_NOT_VERIFIED",
				status: 403,
				message: "not verified",
			},
		} as never);
		renderPage();

		await userEvent.type(
			screen.getByLabelText(/^email$/i),
			"blocked@example.com",
		);
		await userEvent.type(screen.getByLabelText(/^password$/i), "verylongpass");
		await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

		await waitFor(() =>
			expect(
				screen.getByText(/verify your email to sign in/i),
			).toBeInTheDocument(),
		);
		expect(screen.getByText("blocked@example.com")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /resend link/i }),
		).toBeInTheDocument();
	});

	it("does NOT show the verify notice for invalid credentials (401) — falls back to the generic toast", async () => {
		vi.mocked(signIn.email).mockResolvedValue({
			data: null,
			error: {
				code: "INVALID_EMAIL_OR_PASSWORD",
				status: 401,
				message: "Invalid email or password",
			},
		} as never);
		renderPage();

		await userEvent.type(screen.getByLabelText(/^email$/i), "user@example.com");
		await userEvent.type(screen.getByLabelText(/^password$/i), "wrongpass123");
		await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(
			screen.queryByText(/verify your email to sign in/i),
		).not.toBeInTheDocument();
	});
});
