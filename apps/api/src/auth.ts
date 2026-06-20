import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { isAllowedOrigin } from "@/lib/origins";
import { defaultWorkspaceName, provisionWorkspace } from "@/lib/provisioning";

import { account, session, user, verification } from "@llmchat/db";

import type { Env } from "@/env";

type SocialProviders = {
	google?: { clientId: string; clientSecret: string };
	github?: { clientId: string; clientSecret: string };
};

/**
 * Build the Better Auth social-provider config from env — a provider is included
 * ONLY when both its id and secret are present. Same env-driven gating as the
 * Stripe plans: with no credentials set the object is empty, Better Auth exposes
 * no social providers, and /api/oauth-providers reports them as off, so the
 * dashboard buttons stay disabled. This makes merging safe before the OAuth apps
 * exist. Pure + exported so the gating is unit-tested.
 */
export function buildSocialProviders(vars: Env["vars"]): SocialProviders {
	const providers: SocialProviders = {};
	if (vars.GOOGLE_CLIENT_ID && vars.GOOGLE_CLIENT_SECRET) {
		providers.google = {
			clientId: vars.GOOGLE_CLIENT_ID,
			clientSecret: vars.GOOGLE_CLIENT_SECRET,
		};
	}
	if (vars.GITHUB_CLIENT_ID && vars.GITHUB_CLIENT_SECRET) {
		providers.github = {
			clientId: vars.GITHUB_CLIENT_ID,
			clientSecret: vars.GITHUB_CLIENT_SECRET,
		};
	}
	return providers;
}

/**
 * The full Better Auth config for an env. Extracted from createAuth so the
 * env-gated social providers, the account-linking policy, and the provisioning
 * hook can be asserted directly in tests without spinning up the auth runtime.
 */
export function buildAuthOptions(env: Env) {
	return {
		database: drizzleAdapter(db(env), {
			provider: "sqlite",
			schema: { user, session, account, verification },
		}),
		secret: env.vars.BETTER_AUTH_SECRET,
		baseURL: env.vars.BETTER_AUTH_URL,
		emailAndPassword: {
			enabled: true,
			// Length is the only password rule worth enforcing (NIST/OWASP 2026):
			// require a reasonable floor, allow long passphrases, no composition
			// rules. Better Auth hashes with scrypt.
			minPasswordLength: 8,
			maxPasswordLength: 128,
			// Issue a session on sign-up so the user lands straight in onboarding.
			autoSignIn: true,
		},
		// Google + GitHub, included only when their env credentials are set (see
		// buildSocialProviders). A social sign-up inserts a `user` row, which fires
		// the same `databaseHooks.user.create.after` provisioning hook below — so an
		// OAuth user gets the same workspace + owner membership as an email sign-up.
		socialProviders: buildSocialProviders(env.vars),
		// Link a social login to an EXISTING account when the verified email matches
		// (Google/GitHub are trusted — they verify emails), instead of erroring or
		// creating a duplicate. Verified in Better Auth 1.6.9: an existing
		// email/password user (even emailVerified:false) is found by lowercased
		// email and the account is linked WITHOUT creating a new user — so the
		// provisioning hook never double-fires and no duplicate workspace is made.
		account: {
			accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
		},
		// Every new account is provisioned a free-plan workspace + owner member,
		// so a real sign-up never lands in a workspace-less dashboard. Fires once
		// per user creation; raw-SQL seed users don't trigger it. Failures are
		// swallowed — onboarding get-or-creates a workspace as a backstop.
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						try {
							await provisionWorkspace(
								db(env),
								createdUser.id,
								defaultWorkspaceName(createdUser.name),
							);
						} catch (err) {
							console.error("sign-up: workspace provisioning failed", err);
						}
					},
				},
			},
		},
		// Trust the canonical dashboard plus its Ploy preview deployments, so
		// sign-in works from PR preview links.
		trustedOrigins: (request) => {
			const origin = request?.headers.get("origin");
			const dash = env.vars.DASHBOARD_URL;
			const mkt = env.vars.MARKETING_URL || "http://localhost:3002";
			const showcase = env.vars.SHOWCASE_URL || "http://localhost:3003";
			if (
				origin &&
				(isAllowedOrigin(origin, dash) ||
					isAllowedOrigin(origin, mkt) ||
					isAllowedOrigin(origin, showcase))
			) {
				return [origin];
			}
			return [dash, mkt, showcase];
		},
	} satisfies Parameters<typeof betterAuth>[0];
}

export function createAuth(env: Env) {
	return betterAuth(buildAuthOptions(env));
}

export type Auth = ReturnType<typeof createAuth>;
