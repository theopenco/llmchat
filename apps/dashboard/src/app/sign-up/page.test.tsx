import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { signUp } from "@/lib/auth-client";

import SignUpPage from "./page";

vi.mock("@/lib/auth-client", () => ({
	signUp: { email: vi.fn() },
	sendVerificationEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/lib/analytics", () => ({
	track: vi.fn(),
	ANALYTICS_EVENTS: { signupCompleted: "signup_completed" },
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
			<SignUpPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("SignUpPage — email verification", () => {
	it("shows the 'check your email' notice (address + resend) after a successful signup, without navigating", async () => {
		vi.mocked(signUp.email).mockResolvedValue({
			data: { token: null, user: {} },
			error: null,
		} as never);
		renderPage();

		await userEvent.type(
			screen.getByLabelText(/^email$/i),
			"newuser@example.com",
		);
		await userEvent.type(screen.getByLabelText(/^password$/i), "verylongpass");
		await userEvent.click(
			screen.getByRole("button", { name: /create account/i }),
		);

		await waitFor(() =>
			expect(
				screen.getByText(/we sent a verification link to/i),
			).toBeInTheDocument(),
		);
		expect(screen.getByText("newuser@example.com")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /resend link/i }),
		).toBeInTheDocument();
	});
});
