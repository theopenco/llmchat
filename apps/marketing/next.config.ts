import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/shared"],
};

export default withContentCollections(config);
