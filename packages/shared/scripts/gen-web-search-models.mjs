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

// A provider route the support agent can actually serve today: web search
// (the agent's grounding contract), tool calling (integration actions such as
// Cal.com booking and Shopify order lookup run as tools), and not yet
// deactivated by the gateway (calls to a deactivated route fail).
const now = Date.now();
const servable = (p) =>
	p.webSearch === true &&
	p.tools === true &&
	!(p.deactivatedAt && new Date(p.deactivatedAt).getTime() <= now);

// Text-out chat models only: image-generation models also advertise web
// search but can't hold a support conversation.
const textOnly = (m) => !m.output || m.output.every((o) => o === "text");

const ids = models
	.filter((m) => textOnly(m) && m.providers.some(servable))
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
// Source of truth: @llmgateway/models — text chat models with at least one live
// provider route that advertises \`webSearch\` and \`tools\`.

export const WEB_SEARCH_MODELS: readonly string[] = [
${ids.map((id) => `\t${JSON.stringify(id)},`).join("\n")}
];
`;

writeFileSync(out, body);
console.log(`gen-web-search-models: wrote ${ids.length} ids to ${out}`);
