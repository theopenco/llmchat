import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

import type { Env } from "@/env";

export function createAuth(env: Env) {
	return betterAuth({
		database: drizzleAdapter(db(env), { provider: "sqlite" }),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		emailAndPassword: {
			enabled: true,
		},
		trustedOrigins: [env.DASHBOARD_URL],
		plugins: [passkey()],
	});
}

export type Auth = ReturnType<typeof createAuth>;
