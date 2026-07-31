import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit } from "@/lib/kv";
import { buildSystem } from "@/lib/llm";
import { insertMessage } from "@/lib/messages";
import { resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";
import { clientIp } from "@/lib/request";

import { usageEvent } from "@llmchat/db";
import { ANALYTICS_EVENTS } from "@llmchat/shared";

import type { AppContext } from "@/env";

/**
 * Live AI voice calls (Scale-only premium) over LLM Gateway's realtime models.
 *
 * The api never touches audio. It only MINTS an ephemeral client secret
 * (server-to-server, using the long-lived operator key) and hands it to the
 * widget, which opens its own WebSocket straight to the gateway
 * (wss://…/v1/realtime). Per the gateway docs a long-lived API key must never
 * ship to a browser — the ephemeral secret is the browser-safe credential, and
 * the gateway's own per-session caps (duration + spend) bound a runaway call.
 *
 * The gateway's mint endpoint accepts ONLY `{ type, model }` (probed: any
 * other key — instructions, voice, audio — is a 400); per its docs, session
 * configuration happens over the WebSocket via `session.update`. So the MODEL
 * is locked at mint (a session.update changing it is rejected with
 * `model_locked` — a visitor can't trade up to a pricier model), while the
 * assembled instructions + voice are returned to the widget to apply on
 * connect. That hands the prompt text to the client — acceptable: the visitor
 * holds the socket and could session.update their own instructions regardless,
 * and spend stays bounded by the gateway's per-session caps + the budgets here.
 */

// The realtime model every voice session runs. Deliberately NOT the project's
// configured chat model: realtime is a separate model family (and not a
// web-search model), so it bypasses resolveServableModel on purpose — the
// entitlement gate below is what prices it, not model access.
const REALTIME_MODEL = "gpt-realtime";

// Default output voice (gateway/OpenAI catalog).
const REALTIME_VOICE = "marin";

// Fallback when LLMGATEWAY_BASE_URL is unset in the runtime env — the same
// default the AI SDK provider applies for chat, so voice and chat can never
// disagree about where the gateway lives. (Prod initially shipped without the
// var; chat kept working on the provider default while this route 500'd on
// the undefined dereference.)
const DEFAULT_GATEWAY_BASE = "https://api.llmgateway.io/v1";

// Voice sessions cost realtime-audio money on the shared operator key (the
// gateway's default per-session spend cap alone is $10), so the budgets are far
// tighter than chat's 20/hr — and FAIL CLOSED, like the integration-action
// guards: during a STATE outage, unbounded call minting is the worse risk.
const CALL_RATE_MAX = 4;
const CALL_RATE_WINDOW = 60 * 60;
const CALL_DAILY_MAX = 20;
const CALL_DAILY_WINDOW = 24 * 60 * 60;

/**
 * Spoken-channel addendum appended after the assembled support prompt. The
 * base scaffold + operator prompt + knowledge assembly is byte-identical to
 * the text agent's (one assembler, see buildSystem) — this only adapts the
 * delivery to audio.
 */
export const VOICE_CALL_STYLE_PROMPT = `# Voice call

You are on a live voice call with the visitor. Adapt your delivery:
1. Speak naturally and conversationally. Keep answers to one or two short sentences, then pause — never deliver a monologue or a list.
2. Never use markdown, bullet points, URLs spelled out character by character, or anything that only works in writing. Describe links ("the pricing page on our website") instead of reading them.
3. If the visitor asks for a human, tell them to use the "Talk to a human" option in the chat window — you cannot transfer the call.
4. If you can't hear them clearly or the question is ambiguous, ask a short clarifying question.
5. Open the call with ONE short greeting sentence offering to help, in the language the operator instructions are written in. If the visitor speaks a different language, switch to theirs.`;

const sessionBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
});

export const voice = new Hono<AppContext>().post(
	"/voice/session",
	zValidator("json", sessionBody),
	async (c) => {
		const { projectKey, clientId } = c.req.valid("json");

		// Per-IP gate BEFORE the project lookup — bounds invalid-key DB floods
		// (same shape as every other public /v1 endpoint).
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const project = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.publicKey, projectKey),
		});
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

		// Entitlement gate: voice is Scale-only (internal workspaces carry
		// voiceCalls too via INTERNAL_ENTITLEMENTS). 402 matches the paywall
		// convention — and the widget never shows the call button unless
		// /v1/config said voiceEnabled, so hitting this means a forged request.
		const { exempt, entitlements } = await resolveAccess(
			c.env,
			project.workspaceId,
		);
		if (!entitlements.voiceCalls) {
			return c.json({ error: "voice_not_available" }, 402);
		}

		// Tight, fail-closed budgets (see constants above): per-(project,IP)
		// hourly AND a per-project daily aggregate against IP rotation.
		// Internal/founder workspaces skip them — same as every other cap they're
		// exempt from (paywall, quotas, metering): the spend lands on the
		// operator's own key, dogfooding must never be throttled, and the
		// gateway's per-session duration/spend caps still bound a runaway call.
		if (!exempt) {
			const perIp = await rateLimit(
				c.env,
				`voice:${project.id}:${ip}`,
				CALL_RATE_MAX,
				CALL_RATE_WINDOW,
				{ failClosed: true },
			);
			if (!perIp.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}
			const perProjectDaily = await rateLimit(
				c.env,
				`voice-daily:${project.id}`,
				CALL_DAILY_MAX,
				CALL_DAILY_WINDOW,
				{ failClosed: true },
			);
			if (!perProjectDaily.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}
		}

		// Assemble the session instructions exactly like a chat turn: active
		// prompt variant, knowledge base, active sources, and the STORED
		// conversation identity (never the request body). The conversation is
		// optional — a visitor may start a call before ever typing.
		let activePromptContent = project.systemPrompt;
		if (project.activeSystemPromptId) {
			const active = await db(c.env).query.systemPrompt.findFirst({
				where: (sp, { and: a, eq: e }) =>
					a(
						e(sp.id, project.activeSystemPromptId!),
						e(sp.projectId, project.id),
					),
			});
			if (active) activePromptContent = active.content;
		}
		const activeSources = await db(c.env).query.source.findMany({
			where: (s, { and: a, eq: e }) =>
				a(e(s.projectId, project.id), e(s.active, true)),
		});
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});

		const instructions = [
			buildSystem(
				activePromptContent,
				project.knowledgeText,
				activeSources.map((s) => ({
					title: s.title || s.url || "",
					url: s.url ?? "",
					content: s.content,
				})),
				conv ? { name: conv.name, email: conv.email } : undefined,
			),
			VOICE_CALL_STYLE_PROMPT,
		].join("\n\n");

		// Mint the ephemeral client secret server-to-server. The base URL
		// already carries /v1 (see .env.example), same as the chat provider.
		const base = (
			c.env.vars.LLMGATEWAY_BASE_URL || DEFAULT_GATEWAY_BASE
		).replace(/\/$/, "");
		let minted: {
			value?: unknown;
			expires_at?: unknown;
			client_secret?: { value?: unknown; expires_at?: unknown };
		};
		try {
			const res = await fetch(`${base}/realtime/client_secrets`, {
				method: "POST",
				headers: {
					authorization: `Bearer ${c.env.vars.LLMGATEWAY_API_KEY}`,
					"content-type": "application/json",
				},
				// Minimal by the gateway's schema — model only; instructions and
				// voice ride the response below for the widget's session.update.
				body: JSON.stringify({
					session: { type: "realtime", model: REALTIME_MODEL },
				}),
			});
			if (!res.ok) {
				console.error(
					`voice: client_secrets mint failed (${res.status})`,
					await res.text().catch(() => ""),
				);
				return c.json({ error: "voice unavailable" }, 502);
			}
			minted = (await res.json()) as typeof minted;
		} catch (err) {
			console.error("voice: client_secrets mint failed", err);
			return c.json({ error: "voice unavailable" }, 502);
		}

		// Both response shapes seen in the wild: flat { value, expires_at } and
		// nested { client_secret: { value, expires_at } }.
		const secret =
			typeof minted.value === "string"
				? minted.value
				: typeof minted.client_secret?.value === "string"
					? minted.client_secret.value
					: null;
		const expiresAt =
			typeof minted.expires_at === "number"
				? minted.expires_at
				: typeof minted.client_secret?.expires_at === "number"
					? minted.client_secret.expires_at
					: null;
		if (!secret) {
			console.error("voice: mint response had no client secret");
			return c.json({ error: "voice unavailable" }, 502);
		}

		// The widget connects here directly (WebSocket transport only, per the
		// gateway docs) — https→wss on the same host and /v1 path.
		const wsUrl = `${base.replace(/^http/, "ws")}/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`;

		c.executionCtx.waitUntil(
			(async () => {
				try {
					// One usage row per minted session — kind 'voice' keeps it out of
					// the text-response quota (monthlyResponseCount filters kind='chat')
					// while the dashboard still sees the activity. Token counts stay 0:
					// the audio never transits the api, so the gateway is the system of
					// record for realtime spend.
					await db(c.env)
						.insert(usageEvent)
						.values({
							workspaceId: project.workspaceId,
							projectId: project.id,
							conversationId: conv?.id ?? "",
							messageId: "",
							model: REALTIME_MODEL,
							kind: "voice",
							promptTokens: 0,
							completionTokens: 0,
							costUsd: 0,
						});
					// Inbox breadcrumb so the operator knows a call happened — only
					// when there is a conversation to attach it to.
					if (conv) {
						await insertMessage(c.env, {
							conversationId: conv.id,
							role: "system",
							content: "Visitor started a voice call with the AI agent",
						});
					}
					await captureEvent(c.env, {
						event: ANALYTICS_EVENTS.voiceCallStarted,
						distinctId: clientId,
						properties: {
							project_id: project.id,
							workspace_id: project.workspaceId,
							model: REALTIME_MODEL,
						},
					});
				} catch (err) {
					console.error("voice: session bookkeeping failed", err);
				}
			})(),
		);

		return c.json({
			url: wsUrl,
			clientSecret: secret,
			expiresAt,
			model: REALTIME_MODEL,
			// Applied by the widget in its post-connect session.update — the
			// gateway's mint endpoint doesn't accept either (see module comment).
			instructions,
			voice: REALTIME_VOICE,
		});
	},
);
