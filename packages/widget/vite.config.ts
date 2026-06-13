import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	// Vite lib mode keeps `process.env.NODE_ENV` references (from React) in the
	// bundle; there is no `process` in the browser, so inline it at build time.
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
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
