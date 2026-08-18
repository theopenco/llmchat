import { Hono } from "hono";

import { decodeBase64 } from "@/lib/avatar";
import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/plan";

import type { AppContext } from "@/env";
import type { Database } from "@llmchat/db";

/** The project's uploaded avatar row, or null when there is none — including
 * on a preview DB that lacks the table entirely (migrations skipped), which
 * must degrade the feature, never 500 the public config/asset routes. */
async function findUploadedAvatar(dbi: Database, projectId: string) {
	try {
		return (
			(await dbi.query.projectAvatar.findFirst({
				where: (t, { eq: e }) => e(t.projectId, projectId),
			})) ?? null
		);
	} catch {
		return null;
	}
}

/**
 * Public, server-authoritative widget config for a live embed. The only field
 * that can't live in the embed snippet's data attributes is branding: whether
 * the "Powered by" badge shows is decided by the owning workspace's plan, not
 * by the customer's markup, so a customer can't strip the badge by editing the
 * snippet. The widget fetches this on mount.
 */
export const widgetConfig = new Hono<AppContext>()
	.get("/config/:key", async (c) => {
		const key = c.req.param("key");
		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, key),
			columns: {
				id: true,
				workspaceId: true,
				privacyPolicyUrl: true,
				suggestedQuestions: true,
				collectIdentity: true,
				welcomeMessage: true,
				avatarUrl: true,
			},
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		// An UPLOADED agent photo wins over the avatarUrl field. The URL is
		// built from this request's origin (never stored absolute) so it
		// survives domain moves and self-hosts; ?v= busts browser/edge caches
		// on re-upload, letting the asset route serve immutable.
		const uploadedAvatar = await findUploadedAvatar(db(c.env), project.id);
		// Branding follows the resolved tier: exempt/internal and Growth/Scale
		// suppress the badge; Starter (and unpaid) show it.
		const { entitlements } = await resolveAccess(c.env, project.workspaceId);
		return c.json({
			showBranding: entitlements.branding === "badge",
			// Live AI voice calls — Scale-only (internal carries it too). Server-
			// authoritative like branding: the widget only shows the call button on
			// an explicit true, and /v1/voice/session re-checks the entitlement, so
			// a forged config can't actually mint a session.
			voiceEnabled: entitlements.voiceCalls === true,
			// Null → the widget links its privacy notice to its built-in default.
			privacyPolicyUrl: project.privacyPolicyUrl ?? null,
			// Starter-question chips the widget offers before the first message.
			// Guarded: a malformed/legacy column value degrades to no chips.
			suggestedQuestions: Array.isArray(project.suggestedQuestions)
				? project.suggestedQuestions.filter((q) => typeof q === "string")
				: [],
			// Whether the widget asks for name/email before chatting. Off by
			// default — the widget opens straight into the conversation.
			collectIdentity: project.collectIdentity === true,
			// The operator-configured greeting shown before the first message.
			// Guarded: a non-string/legacy value degrades to null, and the widget
			// then falls back to its built-in default greeting.
			welcomeMessage:
				typeof project.welcomeMessage === "string"
					? project.welcomeMessage
					: null,
			// Operator-set agent photo/logo for the launcher and header. Guarded:
			// a legacy row (column absent) or blank value degrades to null, and
			// the widget keeps its default mark.
			avatarUrl: uploadedAvatar
				? `${new URL(c.req.url).origin}/v1/avatar/${encodeURIComponent(key)}?v=${Math.floor(uploadedAvatar.updatedAt.getTime() / 1000)}`
				: typeof project.avatarUrl === "string" && project.avatarUrl !== ""
					? project.avatarUrl
					: null,
		});
	})
	.get("/avatar/:key", async (c) => {
		// The uploaded agent photo as a public image asset (the widget <img>s the
		// URL the config above hands out). Keyed by the project's PUBLIC key — the
		// same identifier every /v1 widget route already exposes.
		const key = c.req.param("key");
		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, key),
			columns: { id: true },
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		const uploaded = await findUploadedAvatar(db(c.env), project.id);
		const bytes = uploaded ? decodeBase64(uploaded.data) : null;
		if (!uploaded || !bytes) {
			return c.json({ error: "no avatar" }, 404);
		}
		return c.body(bytes, 200, {
			"content-type": uploaded.contentType,
			// Config URLs carry ?v=<updatedAt>, so long immutable caching is safe —
			// a re-upload changes the URL rather than waiting out a TTL.
			"cache-control": "public, max-age=86400, immutable",
		});
	});
