import { Hono } from "hono";

import type { AppContext } from "@/env";

// At build time, packages/widget produces dist/widget.js which the api project
// includes as a static asset. For now we serve a placeholder that calls
// console.error so misconfigured embeds are obvious.
const PLACEHOLDER = `console.error("[llmchat] widget bundle not built yet — run \`pnpm --filter @llmchat/widget build\`");`;

export const widgetAsset = new Hono<AppContext>().get("/widget.js", (c) => {
	c.header("content-type", "application/javascript; charset=utf-8");
	c.header("cache-control", "public, max-age=300");
	return c.body(PLACEHOLDER);
});
