import type { NextConfig } from "next";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/shared"],
};

export default config;
