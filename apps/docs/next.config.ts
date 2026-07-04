import { createMDX } from "fumadocs-mdx/next";

import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
	// Keep dev artifacts out of .next so `next build` and the ploy-managed dev
	// server never fight over the same directory.
	distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
	reactStrictMode: true,
	transpilePackages: ["@llmchat/shared"],
};

export default withMDX(config);
