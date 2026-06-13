import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";
import { isAllowedOrigin } from "@/lib/origins";

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
		},
		// Trust the canonical dashboard plus its Ploy preview deployments, so
		// sign-in works from PR preview links.
		trustedOrigins: (request) => {
			const origin = request?.headers.get("origin");
			return origin && isAllowedOrigin(origin, env.vars.DASHBOARD_URL)
				? [origin]
				: [env.vars.DASHBOARD_URL];
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
