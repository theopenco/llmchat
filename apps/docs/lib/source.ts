import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

import { docs, meta } from "../.source/server";

export const source = loader({
	baseUrl: "/",
	source: toFumadocsSource(docs, meta),
	plugins: [lucideIconsPlugin()],
});
