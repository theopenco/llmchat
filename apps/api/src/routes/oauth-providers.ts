import { Hono } from "hono";

import { buildSocialProviders } from "@/auth";

import type { AppContext } from "@/env";

/**
 * Public, unauthenticated config the (logged-out) sign-in/sign-up pages read to
 * decide which social buttons to enable. Reports a provider as `true` only when
 * its credentials are configured — the single source of truth is the same env
 * check Better Auth uses (buildSocialProviders), so the button state can never
 * drift from whether the provider actually works. With nothing configured both
 * are `false` and the buttons stay disabled ("Soon").
 *
 * Mounted under /api but deliberately NOT under /api/auth (Better Auth's
 * catch-all) and with no session requirement.
 */
export const oauthProviders = new Hono<AppContext>().get(
	"/oauth-providers",
	(c) => {
		const providers = buildSocialProviders(c.env.vars);
		return c.json({
			google: !!providers.google,
			github: !!providers.github,
		});
	},
);
