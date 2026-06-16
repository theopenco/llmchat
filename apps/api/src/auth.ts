import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { isAllowedOrigin } from "@/lib/origins";
import { defaultWorkspaceName, provisionWorkspace } from "@/lib/provisioning";

import { account, session, user, verification } from "@llmchat/db";

import type { Env } from "@/env";

export function createAuth(env: Env) {
	return betterAuth({
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
	});
}

export type Auth = ReturnType<typeof createAuth>;
