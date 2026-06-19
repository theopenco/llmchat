import { defineConfig } from "vitest/config";

// The marketing app's SEO helpers (lib/seo.ts) are pure, so a Node environment
// is enough — no jsdom, no Next runtime, no content-collections build.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
