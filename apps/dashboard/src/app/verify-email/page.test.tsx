import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "./page";

// Landing reached via Better Auth's redirect with ?error=CODE on a bad/expired
// link. useSession is irrelevant on the error path.
vi.mock("next/navigation", () => ({
	useSearchParams: () => new URLSearchParams("error=token_expired"),
}));
vi.mock("@/lib/auth-client", () => ({
	useSession: () => ({ data: null, isPending: false }),
	sendVerificationEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("VerifyEmailPage — error path", () => {
	it("shows the expired-link message and a resend form when ?error is present", () => {
		render(<VerifyEmailPage />);
		expect(
			screen.getByText(/this verification link has expired/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /send a new link/i }),
		).toBeInTheDocument();
	});
});
