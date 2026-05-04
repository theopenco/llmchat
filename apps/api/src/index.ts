import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "@/auth";
import { billing } from "@/routes/billing";
import { chat } from "@/routes/chat";
import { conversations } from "@/routes/conversations";
import { inboundEmail } from "@/routes/inbound-email";
import { projects } from "@/routes/projects";
import { widgetAsset } from "@/routes/widget-asset";
import { workspaces } from "@/routes/workspaces";

import type { AppContext } from "@/env";

const app = new Hono<AppContext>();

app.use(
	"/api/*",
	cors({
		origin: (origin, c) => {
			const allowed = c.env.DASHBOARD_URL;
			return origin === allowed ? origin : null;
		},
		credentials: true,
	}),
);

app.use(
	"/v1/*",
	cors({
		origin: (origin, c) => {
			const list = (c.env.WIDGET_ALLOWED_ORIGINS ?? "")
				.split(",")
				.map((s: string) => s.trim())
				.filter(Boolean);
			if (list.length === 0 || list.includes("*")) {
				return origin ?? "*";
			}
			return list.includes(origin ?? "") ? origin! : null;
		},
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
app.route("/api", conversations);
app.route("/", inboundEmail);
app.route("/api", billing);
app.route("/", widgetAsset);

app.get("/", (c) => c.json({ name: "llmchat-api", ok: true }));

export default app;
