import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	// Vite lib mode keeps `process.env.NODE_ENV` references (from React) in the
	// bundle; there is no `process` in the browser, so inline it at build time.
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
	},
	resolve: {
		alias: {
			// Streamdown lazy-loads mermaid for ```mermaid blocks. The widget is a
			// single inlined IIFE, so that lazy chunk gets inlined and would pull in
			// the whole (~MB) mermaid library. Support replies never contain
			// diagrams, so alias it to a no-op stub to keep widget.js small.
			mermaid: fileURLToPath(new URL("./src/mermaid-stub.ts", import.meta.url)),
		},
	},
	build: {
		lib: {
			entry: "src/mount.tsx",
			formats: ["iife"],
			name: "LlmchatWidget",
			fileName: () => "widget.js",
		},
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
			},
		},
		cssCodeSplit: false,
	},
});
