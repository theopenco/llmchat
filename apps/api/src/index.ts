import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "@/auth";
import { isAllowedOrigin } from "@/lib/origins";
import { billing } from "@/routes/billing";
import { chat } from "@/routes/chat";
import { conversations } from "@/routes/conversations";
import { embed } from "@/routes/embed";
import { inboundEmail } from "@/routes/inbound-email";
import { projects } from "@/routes/projects";
import { sources } from "@/routes/sources";
import { systemPrompts } from "@/routes/system-prompts";
import { widgetAsset } from "@/routes/widget-asset";
import { widgetMessages } from "@/routes/widget-messages";
import { workspaces } from "@/routes/workspaces";

import type { AppContext } from "@/env";

const app = new Hono<AppContext>();

app.use(
	"/api/*",
	cors({
		origin: (origin, c) =>
			isAllowedOrigin(origin, c.env.vars.DASHBOARD_URL) ? origin : null,
		credentials: true,
	}),
);

// Public widget endpoints: allow ALL origins, unconditionally. The widget is a
// public embed that must load on any customer site, and these routes are
// non-credentialed, so `Access-Control-Allow-Origin: *` is valid. This does NOT
// read WIDGET_ALLOWED_ORIGINS — the env-based gate is gone for /v1/*.
// Per-PROJECT domain restriction (future) is enforced separately server-side
// (against the request's project), not via this global CORS gate.
app.use(
	"/v1/*",
	cors({
		origin: "*",
		credentials: false,
	}),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => {
	const auth = createAuth(c.env);
	return auth.handler(c.req.raw);
});

app.route("/v1", chat);
app.route("/v1", widgetMessages);
app.route("/api", workspaces);
app.route("/api", projects);
app.route("/api", systemPrompts);
app.route("/api", sources);
app.route("/api", conversations);
app.route("/", inboundEmail);
app.route("/api", billing);
app.route("/", widgetAsset);
app.route("/", embed);

app.get("/", (c) => c.json({ name: "llmchat-api", ok: true }));

export default app;
