import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "@/auth";
import { adminUrl } from "@/lib/admin";
import { isAllowedOrigin } from "@/lib/origins";
import { periodForCron, runTrafficReport } from "@/lib/traffic-report";
import { account } from "@/routes/account";
import { admin } from "@/routes/admin";
import { billing } from "@/routes/billing";
import { chat } from "@/routes/chat";
import { conversations } from "@/routes/conversations";
import { embed } from "@/routes/embed";
import { inboundEmail } from "@/routes/inbound-email";
import { notifications } from "@/routes/notifications";
import { oauthProviders } from "@/routes/oauth-providers";
import { projects } from "@/routes/projects";
import { search } from "@/routes/search";
import { sources } from "@/routes/sources";
import { systemPrompts } from "@/routes/system-prompts";
import { tags } from "@/routes/tags";
import { widgetAsset } from "@/routes/widget-asset";
import { widgetConfig } from "@/routes/widget-config";
import { widgetCsat } from "@/routes/widget-csat";
import { widgetMessages } from "@/routes/widget-messages";
import { widgetRating } from "@/routes/widget-rating";
import { workspaces } from "@/routes/workspaces";

import type { AppContext } from "@/env";

export const app = new Hono<AppContext>();

app.use(
	"/api/*",
	cors({
		origin: (origin, c) => {
			const dash = c.env.vars.DASHBOARD_URL;
			// Auth/session endpoints are also readable from the marketing site so the
			// public pages can show "Sign in" vs "Dashboard" based on the session.
			// Data routes stay pinned to the dashboard origin.
			if (c.req.path.startsWith("/api/auth")) {
				const mkt = c.env.vars.MARKETING_URL || "http://localhost:3002";
				const showcase = c.env.vars.SHOWCASE_URL || "http://localhost:3003";
				// The admin console signs in through Better Auth too, so its origin
				// must be allowed to read/write /api/auth/*.
				return isAllowedOrigin(origin, dash) ||
					isAllowedOrigin(origin, mkt) ||
					isAllowedOrigin(origin, showcase) ||
					isAllowedOrigin(origin, adminUrl(c.env))
					? origin
					: null;
			}
			return isAllowedOrigin(origin, dash) ? origin : null;
		},
		credentials: true,
	}),
);

// Public widget endpoints: allow ALL origins, unconditionally. The widget is a
// public embed that must load on any customer site, and these routes are
// non-credentialed, so `Access-Control-Allow-Origin: *` is valid.
// Per-PROJECT domain restriction (future) is enforced separately server-side
// (against the request's project), not via this global CORS gate.
app.use(
	"/v1/*",
	cors({
		origin: "*",
		credentials: false,
	}),
);

// Billing checkout/portal are called from the dashboard (credentialed), so they
// need the same dashboard-pinned CORS as /api/*. The webhook (/billing/webhook)
// is intentionally NOT listed: Stripe calls it server-to-server with no Origin,
// and it must stay free of any middleware that could touch the raw body.
const billingBrowserCors = cors({
	origin: (origin, c) =>
		isAllowedOrigin(origin, c.env.vars.DASHBOARD_URL) ? origin : null,
	credentials: true,
});
app.use("/billing/checkout", billingBrowserCors);
app.use("/billing/portal", billingBrowserCors);
app.use("/billing/usage", billingBrowserCors);

// Admin console API: credentialed, pinned to the admin origin only (never the
// dashboard/marketing/showcase). Preview deployments of the admin app match via
// isAllowedOrigin's preview-suffix logic. Auth is asserted per-route by
// requireGlobalAdmin — this is just the browser-origin gate.
app.use(
	"/admin/*",
	cors({
		origin: (origin, c) =>
			isAllowedOrigin(origin, adminUrl(c.env)) ? origin : null,
		credentials: true,
	}),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => {
	const auth = createAuth(c.env);
	return auth.handler(c.req.raw);
});

app.route("/v1", chat);
app.route("/v1", widgetConfig);
app.route("/v1", widgetMessages);
app.route("/v1", widgetRating);
app.route("/v1", widgetCsat);
app.route("/api", oauthProviders);
app.route("/api", account);
app.route("/api", workspaces);
app.route("/api", projects);
app.route("/api", search);
app.route("/api", systemPrompts);
app.route("/api", sources);
app.route("/api", tags);
app.route("/api", conversations);
app.route("/api", notifications);
app.route("/", admin);
app.route("/", inboundEmail);
// Billing mounts at root so the webhook is reachable at /billing/webhook
// (the URL registered in Stripe), not under /api.
app.route("/", billing);
app.route("/", widgetAsset);
app.route("/", embed);

app.get("/", (c) => c.json({ name: "llmchat-api", ok: true }));

/** Cron trigger payload Ploy delivers (Cloudflare ScheduledController shape). */
interface ScheduledEvent {
	cron: string;
	scheduledTime: number;
	noRetry(): void;
}

// The worker export: Hono handles requests; `scheduled` receives the Ploy cron
// triggers declared in ploy.yaml (the weekly/monthly traffic report). The
// report is awaited — not waitUntil'd — so a failed run marks the cron
// execution failed in the Ploy dashboard instead of vanishing.
export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: PloyEnv) {
		await runTrafficReport(env, periodForCron(event.cron));
	},
};
