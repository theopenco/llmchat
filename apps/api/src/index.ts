import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "@/auth";
import { billing } from "@/routes/billing";
import { chat } from "@/routes/chat";
import { conversations } from "@/routes/conversations";
import { inboundEmail } from "@/routes/inbound-email";
import { projects } from "@/routes/projects";
import { sources } from "@/routes/sources";
import { systemPrompts } from "@/routes/system-prompts";
import { widgetAsset } from "@/routes/widget-asset";
import { workspaces } from "@/routes/workspaces";

import type { AppContext } from "@/env";

const app = new Hono<AppContext>();

app.use(
	"/api/*",
	cors({
		origin: (origin, c) => {
			const allowed = c.env.vars.DASHBOARD_URL;
			return origin === allowed ? origin : null;
		},
		credentials: true,
	}),
);

// Public widget endpoints embed on arbitrary customer sites — allow any origin.
// Safe because these routes are unauthenticated (no cookies) and gated by the
// per-project public key + rate limiting.
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
app.route("/api", workspaces);
app.route("/api", projects);
app.route("/api", systemPrompts);
app.route("/api", sources);
app.route("/api", conversations);
app.route("/", inboundEmail);
app.route("/api", billing);
app.route("/", widgetAsset);

app.get("/", (c) => c.json({ name: "llmchat-api", ok: true }));

export default app;
