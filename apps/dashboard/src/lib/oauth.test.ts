import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchOAuthProviders, startSocialSignIn } from "./oauth";

const social = vi.fn();
vi.mock("@/lib/auth-client", () => ({
	authClient: { signIn: { social: (...a: unknown[]) => social(...a) } },
}));

describe("startSocialSignIn", () => {
	beforeEach(() => social.mockReset());

	it("starts the provider flow and lands the user in /onboarding (like email sign-up)", () => {
		startSocialSignIn("google");
		expect(social).toHaveBeenCalledTimes(1);
		const arg = social.mock.calls[0][0] as {
			provider: string;
			callbackURL: string;
		};
		expect(arg.provider).toBe("google");
		// Same entry point as email sign-up — the onboarding guard provisions /
		// redirects from here. Absolute URL on the dashboard origin.
		expect(new URL(arg.callbackURL).pathname).toBe("/onboarding");
	});
});

describe("fetchOAuthProviders (fail-safe to disabled)", () => {
	const realFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("returns the API's provider flags on success", async () => {
		globalThis.fetch = vi.fn(async () =>
			Response.json({ google: true, github: false }),
		) as typeof fetch;
		await expect(fetchOAuthProviders()).resolves.toEqual({
			google: true,
			github: false,
		});
	});

	it("treats a non-OK response as everything off", async () => {
		globalThis.fetch = vi.fn(
			async () => new Response("nope", { status: 500 }),
		) as typeof fetch;
		await expect(fetchOAuthProviders()).resolves.toEqual({
			google: false,
			github: false,
		});
	});

	it("treats a network error as everything off (never enables a broken button)", async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new Error("offline");
		}) as typeof fetch;
		await expect(fetchOAuthProviders()).resolves.toEqual({
			google: false,
			github: false,
		});
	});
});
