import defaultMdxComponents from "fumadocs-ui/mdx";

import { ThemedImage } from "@/components/themed-image";

import type { MDXComponents } from "mdx/types";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
	return {
		...defaultMdxComponents,
		ThemedImage,
		...components,
	};
}
