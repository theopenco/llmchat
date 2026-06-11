import { Hono } from "hono";

import { widgetJs } from "@llmchat/widget/bundle";

import type { AppContext } from "@/env";

export const widgetAsset = new Hono<AppContext>().get("/widget.js", (c) => {
	c.header("content-type", "application/javascript; charset=utf-8");
	c.header("cache-control", "public, max-age=300");
	return c.body(widgetJs);
});
