import type { NextConfig } from "next";

// Build guard: the showcase exists to demo the REAL widget, and a missing or
// placeholder key ships a page whose bubble silently talks to nothing (this
// has now happened in prod twice — see the homepage claim-checks). Production
// builds must fail loudly instead of falling back. `next build` loads
// .env.production before this file runs, so the committed key satisfies the
// guard; `next dev` keeps the seeded local-dev-key fallback untouched.
if (process.env.NODE_ENV === "production") {
	const key = process.env.NEXT_PUBLIC_WIDGET_KEY?.trim();
	if (!key || key === "local-dev-key") {
		throw new Error(
			"showcase build: NEXT_PUBLIC_WIDGET_KEY is unset, empty, or the local-dev placeholder. " +
				"Set a real public project key (apps/showcase/.env.production or the Ploy env) — " +
				"a showcase built without one ships a dead demo widget.",
		);
	}
}

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/widget"],
};

export default config;
