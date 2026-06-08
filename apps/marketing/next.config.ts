import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

const config: NextConfig = {
	reactStrictMode: true,
};

export default withContentCollections(config);
