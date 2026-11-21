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

// A provider route the support agent can rely on: web search (the agent's
// grounding contract) and tool calling (integration actions such as Cal.com
// booking and Shopify order lookup run as tools), not deprecated, and not
// deactivating inside the horizon. A route the gateway has already scheduled
// for removal is not offered for NEW selections; routes retiring later are
// kept, and their date is emitted so the runtime guard drops the model on that
// day even if nobody regenerates (see isWebSearchModel).
const DAY = 24 * 60 * 60 * 1000;
const HORIZON_DAYS = 90;
const now = Date.now();
const time = (d) => (d ? new Date(d).getTime() : null);
const servable = (p) => {
	if (p.webSearch !== true || p.tools !== true) return false;
	const deprecated = time(p.deprecatedAt);
	if (deprecated !== null && deprecated <= now) return false;
	const deactivates = time(p.deactivatedAt);
	return deactivates === null || deactivates > now + HORIZON_DAYS * DAY;
};

// The day a model stops being servable: the last scheduled deactivation among
// its servable routes, or null while any servable route has no end date.
const retirement = (m) => {
	const dates = m.providers.filter(servable).map((p) => time(p.deactivatedAt));
	if (dates.some((d) => d === null)) return null;
	return new Date(Math.max(...dates)).toISOString().slice(0, 10);
};

// Text-out chat models only: image-generation models also advertise web
// search but can't hold a support conversation.
const textOnly = (m) => !m.output || m.output.every((o) => o === "text");

const offered = models
	.filter((m) => textOnly(m) && m.providers.some(servable))
	.toSorted((a, b) => a.id.localeCompare(b.id));
const ids = offered.map((m) => m.id);
const retirements = offered
	.map((m) => [m.id, retirement(m)])
	.filter(([, date]) => date !== null);

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
// Source of truth: @llmgateway/models — text chat models with at least one
// provider route that advertises \`webSearch\` and \`tools\`, is not deprecated,
// and is not deactivating within ${HORIZON_DAYS} days of generation.

export const WEB_SEARCH_MODELS: readonly string[] = [
${ids.map((id) => `\t${JSON.stringify(id)},`).join("\n")}
];

// Models whose every servable route has a scheduled deactivation: the date
// (UTC, YYYY-MM-DD) after which isWebSearchModel() stops accepting them.
export const WEB_SEARCH_MODEL_RETIREMENTS: Readonly<Record<string, string>> = {
${retirements.map(([id, date]) => `\t${JSON.stringify(id)}: ${JSON.stringify(date)},`).join("\n")}
};
`;

writeFileSync(out, body);
console.log(`gen-web-search-models: wrote ${ids.length} ids to ${out}`);
