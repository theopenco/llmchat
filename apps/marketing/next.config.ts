import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@llmchat/shared"],
	async redirects() {
		return [
			// The old marketing /docs page moved to the dedicated docs app.
			// Exact-path only: /docs/migrate/* are marketing-owned migration
			// guides and must keep resolving here.
			{
				source: "/docs",
				destination:
					process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.clankersupport.com",
				permanent: true,
			},
		];
	},
};

export default withContentCollections(config);
