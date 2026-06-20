import { describe, expect, it, vi } from "vitest";

import { buildAuthOptions, buildSocialProviders } from "./auth";

import type { Env } from "@/env";

// The provisioning hook calls provisionWorkspace(db(env), …); stub the transport
// so we can assert the hook wiring without a real database.
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
const provisionWorkspace = vi.fn(async (..._args: unknown[]) => ({
	id: "ws-1",
}));
vi.mock("@/lib/provisioning", async (orig) => ({
	...(await orig<typeof import("@/lib/provisioning")>()),
	provisionWorkspace: (...args: unknown[]) => provisionWorkspace(...args),
}));

function vars(overrides: Partial<Env["vars"]> = {}): Env["vars"] {
	return {
		BETTER_AUTH_SECRET: "x".repeat(32),
		BETTER_AUTH_URL: "http://localhost:8787",
		DASHBOARD_URL: "http://localhost:3001",
		MARKETING_URL: "http://localhost:3002",
		SHOWCASE_URL: "http://localhost:3003",
		...overrides,
	} as Env["vars"];
}
const env = (overrides: Partial<Env["vars"]> = {}) =>
	({ vars: vars(overrides), DB: {} }) as unknown as Env;

describe("buildSocialProviders (env gating)", () => {
	it("includes a provider only when BOTH its id and secret are set", () => {
		expect(buildSocialProviders(vars())).toEqual({});
		// Half-configured is treated as off — never a broken half-provider.
		expect(buildSocialProviders(vars({ GOOGLE_CLIENT_ID: "id" }))).toEqual({});
		expect(
			buildSocialProviders(vars({ GITHUB_CLIENT_SECRET: "secret" })),
		).toEqual({});
	});

	it("includes each fully-configured provider", () => {
		const providers = buildSocialProviders(
			vars({
				GOOGLE_CLIENT_ID: "g-id",
				GOOGLE_CLIENT_SECRET: "g-secret",
				GITHUB_CLIENT_ID: "h-id",
				GITHUB_CLIENT_SECRET: "h-secret",
			}),
		);
		expect(providers).toEqual({
			google: { clientId: "g-id", clientSecret: "g-secret" },
			github: { clientId: "h-id", clientSecret: "h-secret" },
		});
	});
});

describe("buildAuthOptions", () => {
	it("exposes no social providers until credentials are configured", () => {
		expect(buildAuthOptions(env()).socialProviders).toEqual({});
	});

	it("exposes configured social providers", () => {
		const opts = buildAuthOptions(
			env({ GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" }),
		);
		expect(Object.keys(opts.socialProviders)).toEqual(["google"]);
	});

	it("links trusted social logins to existing accounts (no duplicate users)", () => {
		// Google/GitHub verify emails, so linking an existing same-email account is
		// safe; this is what prevents a duplicate user + duplicate workspace.
		expect(buildAuthOptions(env()).account).toEqual({
			accountLinking: {
				enabled: true,
				trustedProviders: ["google", "github"],
			},
		});
	});

	it("provisions a workspace + owner membership on user creation (OAuth and email alike)", async () => {
		provisionWorkspace.mockClear();
		const opts = buildAuthOptions(env());

		// This is the single create hook that fires for ANY new user row — email
		// sign-up OR social sign-up — so an OAuth user is provisioned identically.
		await opts.databaseHooks.user.create.after({
			id: "user-9",
			name: "Ada",
		} as never);

		expect(provisionWorkspace).toHaveBeenCalledTimes(1);
		expect(provisionWorkspace).toHaveBeenCalledWith(
			expect.anything(),
			"user-9",
			"Ada's workspace",
		);
	});

	it("swallows provisioning failures so a transient error can't break sign-up", async () => {
		provisionWorkspace.mockRejectedValueOnce(new Error("db down"));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const opts = buildAuthOptions(env());

		await expect(
			opts.databaseHooks.user.create.after({ id: "u", name: null } as never),
		).resolves.toBeUndefined();
		spy.mockRestore();
	});
});
