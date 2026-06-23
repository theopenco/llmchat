// Behavioral test of the account-takeover fix, exercising Better Auth 1.6.9's
// REAL implicit-link decision (`handleOAuthUserInfo` from `better-auth/oauth2`) —
// not a reimplementation. Only the internal adapter is mocked; the branching that
// decides "link vs refuse vs create" is the library's own.
//
// The vector (live in prod, since OAuth is enabled): an attacker signs up
// email/password as victim@example.com (unverified, no email-verification gate
// yet), then a real Google login for that address would implicitly link into the
// attacker's row — handing both parties one account. We close it with
// account.accountLinking.disableImplicitLinking = true.

import { describe, expect, it, vi } from "vitest";

import { handleOAuthUserInfo } from "better-auth/oauth2";

import { buildAuthOptions } from "./auth";

import type { Env } from "@/env";

const VICTIM_EMAIL = "victim@example.com";

/** A verified Google identity for the victim's email (Google always vouches
 * emailVerified — that's what makes the trusted-link path fire). */
const GOOGLE_USERINFO = {
	id: "google-sub-123",
	email: VICTIM_EMAIL,
	emailVerified: true,
	name: "Victim",
	image: null,
};

const GOOGLE_ACCOUNT = {
	providerId: "google",
	accountId: "google-sub-123",
	accessToken: "at",
	refreshToken: "rt",
	idToken: "it",
	accessTokenExpiresAt: undefined,
	refreshTokenExpiresAt: undefined,
	scope: "openid email",
};

/** A spy-backed internalAdapter. `existingUser` = the row found by email
 * (null ⇒ brand-new OAuth identity). `linkedToGoogle` ⇒ that user ALREADY has a
 * linked Google account (the legitimate re-signin case). */
function makeAdapter(
	existingUser: unknown,
	opts: { linkedToGoogle?: boolean } = {},
) {
	const googleAccount = {
		id: "acct-google",
		providerId: "google",
		accountId: GOOGLE_USERINFO.id,
	};
	return {
		findOAuthUser: vi.fn(async () =>
			existingUser
				? {
						user: existingUser,
						accounts: opts.linkedToGoogle
							? [googleAccount]
							: // credential (email/password) account only — NOT linked to google.
								[{ providerId: "credential", accountId: "x" }],
						linkedAccount: opts.linkedToGoogle ? googleAccount : undefined,
					}
				: undefined,
		),
		linkAccount: vi.fn(async () => ({ id: "linked" })),
		createOAuthUser: vi.fn(async () => ({
			user: { id: "new-user", email: VICTIM_EMAIL, emailVerified: true },
			account: { id: "acct" },
		})),
		updateUser: vi.fn(async (id: string, data: Record<string, unknown>) => ({
			id,
			...data,
		})),
		updateAccount: vi.fn(async () => ({ id: "acct-google" })),
		createSession: vi.fn(async (userId: string) => ({
			id: "sess",
			userId,
			token: "tok",
		})),
	};
}

function makeContext(
	accountLinking: Record<string, unknown>,
	adapter: ReturnType<typeof makeAdapter>,
	trustedProviders: string[] = [],
) {
	return {
		context: {
			internalAdapter: adapter,
			options: { account: { accountLinking } },
			trustedProviders,
			secret: "x".repeat(32),
			baseURL: "http://localhost:8787",
			runInBackgroundOrAwait: async (p: unknown) => p,
		},
		request: new Request("http://localhost:8787/api/auth/callback/google"),
		redirect: (url: string) => {
			throw new Error(`unexpected redirect: ${url}`);
		},
	};
}

const OPTS = {
	userInfo: GOOGLE_USERINFO,
	account: GOOGLE_ACCOUNT,
	callbackURL: "/",
	disableSignUp: false,
	overrideUserInfo: false,
};

describe("account-takeover fix — implicit OAuth linking", () => {
	it("REFUSES to implicitly link a verified Google login into an existing (unverified) email/password account", async () => {
		// Our shipped config.
		const adapter = makeAdapter({
			id: "victim-user",
			email: VICTIM_EMAIL,
			emailVerified: false,
		});
		const c = makeContext(
			{ enabled: true, disableImplicitLinking: true },
			adapter,
			[],
		);

		const res = await handleOAuthUserInfo(c as never, OPTS as never);

		// The takeover door is shut: no link, no session, no auto-verify.
		expect(res.error).toBe("account not linked");
		expect(res.data).toBeNull();
		expect(adapter.linkAccount).not.toHaveBeenCalled();
		expect(adapter.createOAuthUser).not.toHaveBeenCalled();
		expect(adapter.createSession).not.toHaveBeenCalled();
		expect(adapter.updateUser).not.toHaveBeenCalled();
	});

	it("CONTRAST: the pre-fix config (trustedProviders, no disableImplicitLinking) DID take over the account — proves the flag is load-bearing", async () => {
		const adapter = makeAdapter({
			id: "victim-user",
			email: VICTIM_EMAIL,
			emailVerified: false,
		});
		// The exact config this PR removes.
		const c = makeContext(
			{ enabled: true, trustedProviders: ["google", "github"] },
			adapter,
			["google", "github"],
		);

		const res = await handleOAuthUserInfo(c as never, OPTS as never);

		// Old behavior: Google links into the attacker's row, flips it verified,
		// and issues a session — both parties now share one account.
		expect(adapter.linkAccount).toHaveBeenCalledTimes(1);
		expect(adapter.updateUser).toHaveBeenCalledWith("victim-user", {
			emailVerified: true,
		});
		expect(adapter.createSession).toHaveBeenCalledWith("victim-user");
		expect(adapter.createOAuthUser).not.toHaveBeenCalled();
		expect(res.error).toBeNull();
		expect((res.data as { user: { id: string } }).user.id).toBe("victim-user");
	});

	it("NON-REGRESSION: a first-time Google signup (no existing email) still creates a user + session", async () => {
		const adapter = makeAdapter(null);
		const c = makeContext(
			{ enabled: true, disableImplicitLinking: true },
			adapter,
			[],
		);

		const res = await handleOAuthUserInfo(c as never, OPTS as never);

		expect(adapter.createOAuthUser).toHaveBeenCalledTimes(1);
		expect(adapter.createSession).toHaveBeenCalledWith("new-user");
		expect(adapter.linkAccount).not.toHaveBeenCalled();
		expect(res.error).toBeNull();
		expect(res.isRegister).toBe(true);
		expect((res.data as { user: { id: string } }).user.id).toBe("new-user");
	});

	it("NON-REGRESSION: re-signin with an ALREADY-linked Google account issues a session and does not re-link", async () => {
		// The everyday flow for an existing OAuth user. disableImplicitLinking must
		// only block linking into a NON-linked account; it must not interfere here.
		const adapter = makeAdapter(
			{ id: "google-user", email: VICTIM_EMAIL, emailVerified: true },
			{ linkedToGoogle: true },
		);
		const c = makeContext(
			{ enabled: true, disableImplicitLinking: true },
			adapter,
			[],
		);

		const res = await handleOAuthUserInfo(c as never, OPTS as never);

		expect(adapter.linkAccount).not.toHaveBeenCalled();
		expect(adapter.createOAuthUser).not.toHaveBeenCalled();
		expect(adapter.createSession).toHaveBeenCalledWith("google-user");
		expect(res.error).toBeNull();
		expect((res.data as { user: { id: string } }).user.id).toBe("google-user");
	});

	it("ships disableImplicitLinking + enabled (so explicit 'Connect' linking, which is NOT gated by this flag, still works) and drops the inert trustedProviders", () => {
		const opts = buildAuthOptions({
			vars: {
				BETTER_AUTH_SECRET: "x".repeat(32),
				BETTER_AUTH_URL: "http://localhost:8787",
				DASHBOARD_URL: "http://localhost:3001",
			},
			DB: {},
			STATE: {},
		} as unknown as Env);
		expect(opts.account).toEqual({
			accountLinking: { enabled: true, disableImplicitLinking: true },
		});
	});
});
