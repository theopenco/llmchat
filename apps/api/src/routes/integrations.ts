// Integration management (dashboard) + the public Shopify-connector register
// endpoint. Config blobs hold credentials, so reads return a MASKED view only
// (kind, enabled, summary, secret tail) — the raw config never leaves the
// server once written.

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit } from "@/lib/kv";
import { clientIp } from "@/lib/request";
import {
	requireRole,
	requireSession,
	requireWorkspace,
} from "@/middleware/session";

import { and, eq, integration } from "@llmchat/db";
import {
	INTEGRATION_KINDS,
	calcomConfigSchema,
	isIntegrationKind,
	maskSecret,
	shopifyConfigSchema,
	type IntegrationKind,
	type IntegrationView,
} from "@llmchat/shared";

import type { AppContext } from "@/env";

async function ensureProject(
	env: AppContext["Bindings"],
	projectId: string,
	workspaceId: string,
) {
	return db(env).query.project.findFirst({
		where: (pt, { and: a, eq: e }) =>
			a(e(pt.id, projectId), e(pt.workspaceId, workspaceId)),
	});
}

/** Build the dashboard-safe view of a stored row (never the raw config). */
export function toIntegrationView(row: {
	kind: string;
	enabled: boolean;
	config: string;
	updatedAt: Date;
}): IntegrationView | null {
	if (!isIntegrationKind(row.kind)) return null;
	let summary = "";
	let secretHint = "";
	try {
		const cfg = JSON.parse(row.config || "{}") as Record<string, unknown>;
		if (row.kind === "calcom") {
			summary = `event type ${cfg.eventTypeId} · ${cfg.timeZone ?? "UTC"}`;
			secretHint = maskSecret(String(cfg.apiKey ?? ""));
		} else {
			summary = String(cfg.shopDomain ?? "");
			secretHint = maskSecret(String(cfg.accessToken ?? ""));
		}
	} catch {
		summary = "invalid configuration";
	}
	return {
		kind: row.kind,
		enabled: row.enabled,
		summary,
		secretHint,
		updatedAt: Math.floor(row.updatedAt.getTime() / 1000),
	};
}

const upsertBody = z.object({
	enabled: z.boolean().default(true),
	// Validated against the kind's schema below — kept loose here so the error
	// can carry the kind-specific message.
	config: z.record(z.string(), z.unknown()),
});

/** Upsert an integration row for (project, kind) with a validated config. */
async function upsertIntegration(
	env: AppContext["Bindings"],
	projectId: string,
	kind: IntegrationKind,
	enabled: boolean,
	config: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const schema = kind === "calcom" ? calcomConfigSchema : shopifyConfigSchema;
	const parsed = schema.safeParse(config);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		return {
			ok: false,
			error: `${issue?.path.join(".") ?? "config"}: ${issue?.message ?? "invalid"}`,
		};
	}
	await db(env)
		.insert(integration)
		.values({
			projectId,
			kind,
			enabled,
			config: JSON.stringify(parsed.data),
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [integration.projectId, integration.kind],
			set: {
				enabled,
				config: JSON.stringify(parsed.data),
				updatedAt: new Date(),
			},
		});
	return { ok: true };
}

export const integrations = new Hono<AppContext>()
	.use("*", requireSession, requireWorkspace)
	.get("/projects/:projectId/integrations", async (c) => {
		const { projectId } = c.req.param();
		const proj = await ensureProject(c.env, projectId, c.get("workspaceId"));
		if (!proj) return c.json({ error: "not found" }, 404);
		const rows = await db(c.env).query.integration.findMany({
			where: (i, { eq: e }) => e(i.projectId, projectId),
		});
		return c.json({
			integrations: rows
				.map(toIntegrationView)
				.filter((v): v is IntegrationView => v !== null),
		});
	})
	.put(
		"/projects/:projectId/integrations/:kind",
		requireRole("admin"),
		zValidator("json", upsertBody),
		async (c) => {
			const { projectId, kind } = c.req.param();
			if (!isIntegrationKind(kind)) {
				return c.json({ error: "unknown integration kind" }, 400);
			}
			const proj = await ensureProject(c.env, projectId, c.get("workspaceId"));
			if (!proj) return c.json({ error: "not found" }, 404);
			const { enabled, config } = c.req.valid("json");
			const result = await upsertIntegration(
				c.env,
				projectId,
				kind,
				enabled,
				config,
			);
			if (!result.ok) {
				return c.json({ error: result.error, code: "invalid_config" }, 400);
			}
			return c.json({ ok: true });
		},
	)
	// Toggle without re-submitting credentials (the dashboard never has them).
	.patch(
		"/projects/:projectId/integrations/:kind",
		requireRole("admin"),
		zValidator("json", z.object({ enabled: z.boolean() })),
		async (c) => {
			const { projectId, kind } = c.req.param();
			if (!isIntegrationKind(kind)) {
				return c.json({ error: "unknown integration kind" }, 400);
			}
			const proj = await ensureProject(c.env, projectId, c.get("workspaceId"));
			if (!proj) return c.json({ error: "not found" }, 404);
			const { enabled } = c.req.valid("json");
			const updated = await db(c.env)
				.update(integration)
				.set({ enabled, updatedAt: new Date() })
				.where(
					and(eq(integration.projectId, projectId), eq(integration.kind, kind)),
				)
				.returning({ id: integration.id });
			if (updated.length === 0) return c.json({ error: "not found" }, 404);
			return c.json({ ok: true });
		},
	)
	.delete(
		"/projects/:projectId/integrations/:kind",
		requireRole("admin"),
		async (c) => {
			const { projectId, kind } = c.req.param();
			if (!isIntegrationKind(kind)) {
				return c.json({ error: "unknown integration kind" }, 400);
			}
			const proj = await ensureProject(c.env, projectId, c.get("workspaceId"));
			if (!proj) return c.json({ error: "not found" }, 404);
			await db(c.env)
				.delete(integration)
				.where(
					and(eq(integration.projectId, projectId), eq(integration.kind, kind)),
				);
			return c.json({ ok: true });
		},
	)
	// One-time pairing code for the Shopify connector app: the merchant copies
	// it from the dashboard into the app, which then pushes shop credentials to
	// the public register endpoint below. Stored in STATE with expiry tracked
	// in the value (the deployed binding has no TTL put — see lib/kv.ts).
	.post(
		"/projects/:projectId/integrations/shopify/connect-code",
		requireRole("admin"),
		async (c) => {
			const { projectId } = c.req.param();
			const proj = await ensureProject(c.env, projectId, c.get("workspaceId"));
			if (!proj) return c.json({ error: "not found" }, 404);
			const code = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
			const expiresAt =
				Math.floor(Date.now() / 1000) + CONNECT_CODE_TTL_SECONDS;
			await c.env.STATE.set(
				connectCodeKey(code),
				JSON.stringify({ projectId, expiresAt }),
			);
			return c.json({ code, expiresInSeconds: CONNECT_CODE_TTL_SECONDS });
		},
	);

const CONNECT_CODE_TTL_SECONDS = 10 * 60;
const connectCodeKey = (code: string) => `shopify-connect:${code}`;

const registerBody = z.object({
	code: z.string().min(8).max(64),
	shopDomain: z.string().min(4).max(255),
	accessToken: z.string().min(6).max(256),
});

// Public (mounted under /v1, CORS-open like the widget routes): the Shopify
// connector app calls this server-to-server after the merchant pastes the
// pairing code. The code is single-use and short-lived; possession of it is
// the authorization to attach shop credentials to that ONE project.
export const integrationsPublic = new Hono<AppContext>().post(
	"/integrations/shopify/register",
	zValidator("json", registerBody),
	async (c) => {
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) return c.json({ error: "rate limit exceeded" }, 429);
		const rl = await rateLimit(c.env, `shopify-register:${ip}`, 10, 3600, {
			// Guessing pairing codes is a credential-write path — deny on store
			// outage rather than allowing unmetered attempts.
			failClosed: true,
		});
		if (!rl.ok) return c.json({ error: "rate limit exceeded" }, 429);

		const { code, shopDomain, accessToken } = c.req.valid("json");
		const raw = await c.env.STATE.get(connectCodeKey(code));
		if (!raw) return c.json({ error: "invalid or expired code" }, 404);
		let stored: { projectId?: string; expiresAt?: number; usedAt?: number };
		try {
			stored = JSON.parse(raw) as typeof stored;
		} catch {
			return c.json({ error: "invalid or expired code" }, 404);
		}
		const now = Math.floor(Date.now() / 1000);
		if (!stored.projectId || stored.usedAt || (stored.expiresAt ?? 0) < now) {
			return c.json({ error: "invalid or expired code" }, 404);
		}
		// Consume BEFORE writing credentials: a replayed code must never
		// overwrite a connection a second time.
		await c.env.STATE.set(
			connectCodeKey(code),
			JSON.stringify({ ...stored, usedAt: now }),
		);

		const result = await upsertIntegration(
			c.env,
			stored.projectId,
			"shopify",
			true,
			{ shopDomain: shopDomain.toLowerCase(), accessToken },
		);
		if (!result.ok) {
			return c.json({ error: result.error, code: "invalid_config" }, 400);
		}
		return c.json({ ok: true });
	},
);

// Referenced by tests to keep kind coverage exhaustive.
export const KNOWN_INTEGRATION_KINDS = INTEGRATION_KINDS;
