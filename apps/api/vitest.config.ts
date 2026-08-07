import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, type Plugin } from "vitest/config";

const src = resolve(__dirname, "./src");
const widgetBundle = resolve(src, "generated/widget-bundle.ts");

/**
 * `src/generated/widget-bundle.ts` is a gitignored artifact of `pnpm --filter
 * @llmchat/widget build`, so it is ABSENT in a fresh clone or worktree. Without
 * it `src/cors.test.ts` — the only test that imports the whole app — cannot even
 * collect, and the suite reports "1 test file failed" while every test it did
 * run passes (#186). Stand in an empty bundle when the artifact is missing:
 * `routes/widget-asset.ts` already degrades to its PLACEHOLDER for exactly this
 * case, and nothing asserts on the bundle's contents. Serving the real
 * `/widget.js` still requires the widget build — this only keeps the api's unit
 * suite from depending on a 900KB frontend artifact.
 */
function widgetBundleFallback(): Plugin {
	const virtualId = "\0llmchat:widget-bundle-fallback";
	return {
		name: "llmchat:widget-bundle-fallback",
		enforce: "pre",
		resolveId(source) {
			if (existsSync(widgetBundle)) return null;
			// Match both the raw specifier and the form the `@` alias rewrites it to.
			return source === "@/generated/widget-bundle" ||
				source === resolve(src, "generated/widget-bundle")
				? virtualId
				: null;
		},
		load(id) {
			return id === virtualId ? 'export const widgetBundle = "";' : null;
		},
	};
}

export default defineConfig({
	plugins: [widgetBundleFallback()],
	resolve: {
		alias: { "@": src },
	},
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
