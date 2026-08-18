// The root route's session fork shares the shell gate's rule: a transient
// get-session failure (429/5xx) must hold — never route a validly-cookied
// user to /sign-in over a blip.

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@/lib/auth-client";

import Home from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace }),
}));
vi.mock("@/lib/auth-client", async (orig) => ({
	...(await orig<typeof import("@/lib/auth-client")>()),
	useSession: vi.fn(),
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

beforeEach(() => replace.mockClear());

describe("root route session fork", () => {
	it("routes a resolved session to /inbox", () => {
		mockSession({ data: { user: { email: "omar@example.com" } } });
		render(<Home />);
		expect(replace).toHaveBeenCalledWith("/inbox");
	});

	it("routes a definitive no-session to /sign-in", () => {
		mockSession({ data: null, error: null });
		render(<Home />);
		expect(replace).toHaveBeenCalledWith("/sign-in");
	});

	it("HOLDS on a transient failure (429) instead of bouncing to /sign-in", () => {
		mockSession({ data: null, error: { status: 429 } });
		render(<Home />);
		expect(replace).not.toHaveBeenCalled();
	});

	it("waits while the session is resolving", () => {
		mockSession({ data: null, isPending: true });
		render(<Home />);
		expect(replace).not.toHaveBeenCalled();
	});

	it("paints the dashboard skeleton while deciding — never a blank page", () => {
		mockSession({ data: null, isPending: true });
		const { container } = render(<Home />);
		expect(container.firstChild).not.toBeNull();
	});
});
