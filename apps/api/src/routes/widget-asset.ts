import { Hono } from "hono";

// Emitted by `pnpm --filter @llmchat/widget build` (see the chained build in
// ploy.yaml and the root dev script) — the IIFE widget bundle as a string, so
// the worker can serve it without runtime filesystem access.
import { widgetBundle } from "@/generated/widget-bundle";

import type { AppContext } from "@/env";

const PLACEHOLDER = `console.error("[llmchat] widget bundle not built yet — run \`pnpm --filter @llmchat/widget build\`");`;

export const widgetAsset = new Hono<AppContext>().get("/widget.js", (c) => {
	c.header("content-type", "application/javascript; charset=utf-8");
	c.header("cache-control", "public, max-age=300");
	c.header("x-content-type-options", "nosniff");
	return c.body(widgetBundle || PLACEHOLDER);
});
