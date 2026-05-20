import type { NextConfig } from "next";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/widget"],
};

export default config;
