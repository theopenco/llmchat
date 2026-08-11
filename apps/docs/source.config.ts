import { defineDocs, frontmatterSchema, metaSchema } from "fumadocs-mdx/config";

import { remarkPricing } from "./lib/remark-pricing";

export const { docs, meta } = defineDocs({
	dir: "content",
	docs: {
		schema: frontmatterSchema,
		postprocess: {
			includeProcessedMarkdown: true,
		},
		mdxOptions: {
			remarkPlugins: [remarkPricing],
		},
	},
	meta: {
		schema: metaSchema,
	},
});
