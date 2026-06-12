import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: { "@": resolve(__dirname, "./src") },
	},
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
