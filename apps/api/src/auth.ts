import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createAuthRateLimitStorage } from "@/lib/auth-rate-limit-storage";
import { db } from "@/lib/db";
import { buildVerificationEmail, sendEmail } from "@/lib/email";
import { isAllowedOrigin } from "@/lib/origins";
import { defaultWorkspaceName, provisionWorkspace } from "@/lib/provisioning";
import { trustedIpHeaders } from "@/lib/request";

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
	// Fail closed on a weak/missing signing secret: it protects every session
	// cookie and verification token. Better Auth only rejects its literal default
	// secret in production — an unset or short secret slips through — so assert
	// here before any auth runtime is constructed.
	const secret = env.vars.BETTER_AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error(
			"BETTER_AUTH_SECRET must be set and at least 32 characters — refusing to start auth with a weak or missing signing secret.",
		);
	}
	return {
		database: drizzleAdapter(db(env), {
			provider: "sqlite",
			schema: { user, session, account, verification },
		}),
		secret,
		baseURL: env.vars.BETTER_AUTH_URL,
		// Durable, cross-isolate auth rate limiting. Better Auth's built-in limiter
		// defaults to in-memory (per-isolate → useless on workerd) and enabled only
		// in production; force it on and back it with the Ploy state binding via
		// customStorage. customStorage (not secondaryStorage) keeps SESSIONS in D1.
		// Built-in rules already cap /sign-in, /sign-up, /change-password,
		// /change-email at 3/10s and reset/verify paths at 3/60s.
		rateLimit: {
			enabled: true,
			customStorage: createAuthRateLimitStorage(env),
		},
		// Make Better Auth's getIp() trust ONLY the operator-configured edge header
		// (default x-real-ip — Ploy's forwarded client IP), never the spoofable
		// x-forwarded-for. Without this, an attacker rotates x-forwarded-for to evade
		// the per-IP auth limits.
		advanced: {
			ipAddress: { ipAddressHeaders: trustedIpHeaders(env) },
		},
		emailAndPassword: {
			enabled: true,
			// Length is the only password rule worth enforcing (NIST/OWASP 2026):
			// require a reasonable floor, allow long passphrases, no composition
			// rules. Better Auth hashes with scrypt.
			minPasswordLength: 8,
			maxPasswordLength: 128,
			// autoSignIn is inert while requireEmailVerification is on (sign-up
			// returns no session until verified), kept for intent.
			autoSignIn: true,
			// SECURITY (account squatting): a new email/password user must prove they
			// own the address before they get a session. Sign-up creates the row but
			// issues NO session; sign-in is blocked (403 EMAIL_NOT_VERIFIED, BA
			// auto-resends) until verified. This gates ONLY the credential path —
			// OAuth (Google/GitHub) arrives emailVerified from the provider and is
			// untouched (the callback issues a session with no verify step).
			requireEmailVerification: true,
		},
		// Verification email transport. Sends on sign-up; clicking the link verifies
		// + auto-signs-in. The link is built deterministically here with a fixed
		// dashboard callbackURL (one trusted landing for both success and the
		// ?error=... case), rather than relying on the per-trigger callbackURL.
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user: u, token }) => {
				const callbackURL = `${env.vars.DASHBOARD_URL}/verify-email`;
				const verifyUrl = `${env.vars.BETTER_AUTH_URL}/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}`;
				const { subject, html, text } = buildVerificationEmail(verifyUrl);
				await sendEmail(env, { to: u.email, subject, html, text });
			},
		},
		// Google + GitHub, included only when their env credentials are set (see
		// buildSocialProviders). A social sign-up inserts a `user` row, which fires
		// the same `databaseHooks.user.create.after` provisioning hook below — so an
		// OAuth user gets the same workspace + owner membership as an email sign-up.
		socialProviders: buildSocialProviders(env.vars),
		// SECURITY (pre-registration account takeover): disable IMPLICIT account
		// linking. Better Auth 1.6.9's link-on-social-signin keys its decision off
		// the INCOMING provider's emailVerified, never the existing local account's
		// — so a verified Google/GitHub login would link into an attacker's
		// pre-created, unverified email/password account (and flip it verified),
		// handing both parties the same account. With OAuth live in prod this is a
		// presently-open door. disableImplicitLinking forces "account not linked" on
		// that path. Non-regressions (tested): a FIRST-TIME social signup (no
		// existing email) still creates a user, and the authenticated explicit
		// "Connect Google/GitHub" route still links — neither is gated by this flag.
		// trustedProviders is dropped: it was inert here (it only relaxes implicit
		// linking, which is now off) and misleadingly implied the old behavior.
		account: {
			accountLinking: { enabled: true, disableImplicitLinking: true },
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
