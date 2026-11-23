import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The marketing app's SEO helpers (lib/seo.ts) are pure, so a Node environment
// is enough — no jsdom, no Next runtime, no content-collections build. The `@/`
// alias mirrors tsconfig's `@/* -> ./src/*` so route modules (e.g. app/robots.ts)
// that import via it resolve under vitest the same way they do in the Next build.
export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
