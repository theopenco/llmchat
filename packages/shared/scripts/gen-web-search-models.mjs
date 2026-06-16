// Regenerate the committed web-search model snapshot from @llmgateway/models.
//
//   pnpm gen:web-search-models   (run after bumping @llmgateway/models)
//
// @llmgateway/models is a DEV dependency used only here — the generated file is
// committed, so build/deploy never needs the package.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { models } from "@llmgateway/models";

const ids = models
	.filter((m) => m.providers.some((p) => p.webSearch === true))
	.map((m) => m.id)
	.toSorted();

// Loud failure: never write an empty list — that would silently blank the
// model picker. A bad regen should stop here, not ship.
if (ids.length === 0) {
	throw new Error(
		"gen-web-search-models: @llmgateway/models yielded 0 web-search models — refusing to write an empty list",
	);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "web-search-models.generated.ts");

const body = `// GENERATED — do not edit.
// Run \`pnpm gen:web-search-models\` after bumping @llmgateway/models.
// Source of truth: @llmgateway/models — models whose providers advertise
// \`webSearch === true\` (the same filter the llmgateway.io web-search page uses).

export const WEB_SEARCH_MODELS: readonly string[] = [
${ids.map((id) => `\t${JSON.stringify(id)},`).join("\n")}
];
`;

writeFileSync(out, body);
console.log(`gen-web-search-models: wrote ${ids.length} ids to ${out}`);
