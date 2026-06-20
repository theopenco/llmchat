import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchOAuthProviders, startSocialSignIn } from "@/lib/oauth";

import { OAuthButtons } from "./oauth-buttons";

vi.mock("@/lib/oauth", () => ({
	fetchOAuthProviders: vi.fn(),
	startSocialSignIn: vi.fn(),
}));

function renderButtons() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<OAuthButtons />
		</QueryClientProvider>,
	);
}

const googleBtn = () =>
	screen.getByRole("button", { name: /continue with google/i });
const githubBtn = () =>
	screen.getByRole("button", { name: /continue with github/i });

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(startSocialSignIn).mockResolvedValue({ error: null } as never);
});

describe("OAuthButtons", () => {
	it("keeps an unconfigured provider disabled with a 'Soon' marker", async () => {
		vi.mocked(fetchOAuthProviders).mockResolvedValue({
			google: false,
			github: false,
		});
		renderButtons();

		// "Soon" appears once the query settles and we KNOW each provider is off.
		await waitFor(() => expect(screen.getAllByText(/^soon$/i)).toHaveLength(2));
		expect(googleBtn()).toBeDisabled();
		expect(githubBtn()).toBeDisabled();
	});

	it("enables a configured provider and starts its OAuth flow on click", async () => {
		vi.mocked(fetchOAuthProviders).mockResolvedValue({
			google: true,
			github: false,
		});
		renderButtons();

		await waitFor(() => expect(googleBtn()).toBeEnabled());
		// GitHub is still off → disabled with its own "Soon".
		expect(githubBtn()).toBeDisabled();
		expect(screen.getAllByText(/^soon$/i)).toHaveLength(1);

		await userEvent.click(googleBtn());
		expect(startSocialSignIn).toHaveBeenCalledWith("google");
	});

	it("never lets the disabled provider trigger sign-in", async () => {
		vi.mocked(fetchOAuthProviders).mockResolvedValue({
			google: false,
			github: false,
		});
		renderButtons();

		await waitFor(() => expect(googleBtn()).toBeDisabled());
		await userEvent.click(googleBtn());
		expect(startSocialSignIn).not.toHaveBeenCalled();
	});
});
