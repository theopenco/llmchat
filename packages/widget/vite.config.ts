import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
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
