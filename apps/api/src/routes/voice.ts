import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { findOrCreateConversation } from "@/lib/conversations";
import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit, reserveOnce } from "@/lib/kv";
import { DEFAULT_GATEWAY_BASE } from "@/lib/llm";
import { insertMessage } from "@/lib/messages";
import { resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";
import { clientIp } from "@/lib/request";
import {
	assembleVoiceInstructions,
	loadVoiceGrounding,
	VOICE_TOKEN_CEILING,
} from "@/lib/voice-instructions";

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

// Voice sessions cost realtime-audio money on the shared operator key (the
// gateway's default per-session spend cap alone is $10), so the budgets are far
// tighter than chat's 20/hr — and FAIL CLOSED, like the integration-action
// guards: during a STATE outage, unbounded call minting is the worse risk.
const CALL_RATE_MAX = 4;
const CALL_RATE_WINDOW = 60 * 60;
const CALL_DAILY_MAX = 20;
const CALL_DAILY_WINDOW = 24 * 60 * 60;

// Workspace-wide daily aggregate on top of the per-project caps: voice is
// Scale-only (maxProjects 20), so per-project buckets alone leave 20 × 20 =
// 400 mints/day of workspace blast radius (~$4k at the gateway's $10
// per-session spend cap). One shared fail-closed bucket bounds a workspace's
// fleet at ~$1k/day worst case while still letting five projects run at
// their full per-project cap simultaneously.
const VOICE_WORKSPACE_DAILY_MAX = 100;

// --- Named-project budget relief (supersedes 661cd84's workspace-scoped
// exemption) ------------------------------------------------------------------
//
// Dogfooding needs more headroom than 4/hr + 20/day, but relief must NEVER key
// off the workspace's internal status: internal project keys are deliberately
// published (the marketing site self-dogfoods its embed key in public page
// source), so any workspace-scoped raise converts dogfood relief into
// anonymous public minting on the operator key — thousands of dollars/day at
// the gateway's per-session caps. Relief is therefore granted only to project
// ids explicitly listed in VOICE_RAISED_LIMIT_PROJECTS (Ploy-set; unset or
// empty ⇒ zero exemptions anywhere), and listed projects keep ENFORCED,
// fail-closed buckets — the constants change, the structure doesn't.
const VOICE_RAISED_HOURLY = 60;
const VOICE_RAISED_DAILY = 500;

/** Resolve the two voice-bucket ceilings for a project: raised for ids listed
 * in VOICE_RAISED_LIMIT_PROJECTS (comma-separated, whitespace-tolerant,
 * exact-id match only), standard for everyone else — including internal
 * workspaces and the published dogfood keys. Pure. */
export function resolveVoiceBudgets(
	projectId: string,
	raisedList: string | undefined,
): { raised: boolean; hourlyMax: number; dailyMax: number } {
	const listed = (raisedList ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.includes(projectId);
	return listed
		? {
				raised: true,
				hourlyMax: VOICE_RAISED_HOURLY,
				dailyMax: VOICE_RAISED_DAILY,
			}
		: { raised: false, hourlyMax: CALL_RATE_MAX, dailyMax: CALL_DAILY_MAX };
}

// Voice instruction assembly lives in lib/voice-instructions.ts — ONE
// implementation shared with the dashboard's budget hint (#182), re-exported
// here so this route stays the public home of the voice API surface (and the
// existing tests' imports keep working).
export {
	assembleVoiceInstructions,
	boundVoiceInstructions,
	estimateRealtimeTokens,
	VOICE_CALL_STYLE_PROMPT,
	VOICE_TOKEN_CEILING,
} from "@/lib/voice-instructions";

const sessionBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
});

// --- Call transcript ----------------------------------------------------------
//
// The api never hears the audio (widget ↔ gateway direct), so the CLIENT is the
// only party that can report what was said: the widget assembles the transcript
// from the realtime API's transcript events and posts it here when the call
// ends. That makes the content client-reported by construction — the same trust
// level as every chat message and the /v1/escalate messages array — so it is
// persisted as a clearly-labeled `system` transcript row, never as authored
// visitor/agent messages.

const transcriptEntry = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(4_000),
});
const transcriptBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	/** Client-minted id for THIS call — the exactly-once key for the teardown
	 * paths that can race (unmount fetch vs pagehide keepalive). */
	callId: z.string().min(1).max(64),
	entries: z.array(transcriptEntry).min(1).max(200),
});

export const TRANSCRIPT_HEADER = "Voice call transcript";
const TRANSCRIPT_OMISSION_NOTE = "… (earlier part of the call omitted)";
// Bounds the system row a hostile client can write (the schema alone allows
// 200 × 4k). Truncation drops the OLDEST turns — the end of a support call
// (the resolution) is the part the operator needs.
const TRANSCRIPT_MAX_CHARS = 16_000;

/** Render transcript entries into the single system message persisted on the
 * conversation. Empty entries drop out; over budget, oldest turns are omitted
 * behind an explicit marker. Pure; exported for tests. */
export function formatTranscriptMessage(
	entries: { role: "user" | "assistant"; content: string }[],
): string {
	let lines = entries
		.map((e) => ({ role: e.role, content: e.content.trim() }))
		.filter((e) => e.content)
		.map((e) => `${e.role === "user" ? "Visitor" : "Agent"}: ${e.content}`);
	if (lines.length === 0) {
		return "";
	}
	let omitted = false;
	const assemble = () =>
		`${TRANSCRIPT_HEADER}\n\n${omitted ? `${TRANSCRIPT_OMISSION_NOTE}\n\n` : ""}${lines.join("\n\n")}`;
	while (lines.length > 1 && assemble().length > TRANSCRIPT_MAX_CHARS) {
		lines = lines.slice(1);
		omitted = true;
	}
	// A single line can still blow the budget on its own — hard-cut it.
	const out = assemble();
	return out.length > TRANSCRIPT_MAX_CHARS
		? out.slice(0, TRANSCRIPT_MAX_CHARS)
		: out;
}

export const voice = new Hono<AppContext>()
	.post("/voice/session", zValidator("json", sessionBody), async (c) => {
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
		const { entitlements } = await resolveAccess(c.env, project.workspaceId);
		if (!entitlements.voiceCalls) {
			return c.json({ error: "voice_not_available" }, 402);
		}

		// Tight, fail-closed budgets (standard, or raised for explicitly listed
		// project ids — never for a workspace class; see resolveVoiceBudgets):
		// per-(project,IP) hourly AND a per-project daily aggregate against IP
		// rotation.
		const budgets = resolveVoiceBudgets(
			project.id,
			c.env.vars.VOICE_RAISED_LIMIT_PROJECTS,
		);
		const perIp = await rateLimit(
			c.env,
			`voice:${project.id}:${ip}`,
			budgets.hourlyMax,
			CALL_RATE_WINDOW,
			{ failClosed: true },
		);
		if (!perIp.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}
		const perProjectDaily = await rateLimit(
			c.env,
			`voice-daily:${project.id}`,
			budgets.dailyMax,
			CALL_DAILY_WINDOW,
			{ failClosed: true },
		);
		if (!perProjectDaily.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}
		// Fleet bound: one shared per-WORKSPACE daily bucket across all its
		// projects (see VOICE_WORKSPACE_DAILY_MAX). Raised (listed) projects
		// skip it: their relief is vetted per id and carries its own enforced
		// 500/day — routing it through this bucket would either nullify the
		// relief or let one dogfood project starve its workspace siblings.
		if (!budgets.raised) {
			const perWorkspaceDaily = await rateLimit(
				c.env,
				`voice-ws-daily:${project.workspaceId}`,
				VOICE_WORKSPACE_DAILY_MAX,
				CALL_DAILY_WINDOW,
				{ failClosed: true },
			);
			if (!perWorkspaceDaily.ok) {
				return c.json({ error: "rate limit exceeded" }, 429);
			}
		}

		// Assemble the session instructions exactly like a chat turn: active
		// prompt variant, knowledge base, active sources, and the STORED
		// conversation identity (never the request body). The conversation is
		// optional — a visitor may start a call before ever typing. Grounding
		// resolution + assembly are shared with the dashboard's budget hint
		// (lib/voice-instructions.ts) so the hint can never disagree with what
		// a call actually gets.
		const grounding = await loadVoiceGrounding(db(c.env), project);
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and: a, eq: e }) =>
				a(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});
		const bounded = assembleVoiceInstructions(
			grounding.promptContent,
			project.knowledgeText,
			grounding.sources,
			conv ? { name: conv.name, email: conv.email } : undefined,
		);
		if (bounded.truncated) {
			// Content-free counter: sizes only, never prompt text. Firing at all
			// means a project's prompt+KB outgrew even the voice budgets (token-
			// dense scripts can) — worth noticing, not worth failing the call.
			console.warn(
				`voice: instructions over token ceiling at mint (est ${bounded.fullEstimatedTokens} > ${VOICE_TOKEN_CEILING}); truncated to est ${bounded.estimatedTokens}`,
			);
		}
		const instructions = bounded.instructions;

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
							content: "Visitor started a voice call with the support agent",
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
	})
	.post("/voice/transcript", zValidator("json", transcriptBody), async (c) => {
		const { projectKey, clientId, callId, entries } = c.req.valid("json");

		// Per-IP gate BEFORE the project lookup — same shape as every other
		// public /v1 endpoint.
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

		// Same entitlement gate as the mint: a workspace without voice can't have
		// had a call, so a transcript for one is a forged request.
		const { entitlements } = await resolveAccess(c.env, project.workspaceId);
		if (!entitlements.voiceCalls) {
			return c.json({ error: "voice_not_available" }, 402);
		}

		// One transcript per call ⇒ the mint's hourly ceiling fits here too
		// (raised projects included). Fail-OPEN, unlike the mint: this is a
		// bounded DB write, not gateway spend, and a STATE outage should not
		// silently discard call records.
		const budgets = resolveVoiceBudgets(
			project.id,
			c.env.vars.VOICE_RAISED_LIMIT_PROJECTS,
		);
		const rl = await rateLimit(
			c.env,
			`voice-transcript:${project.id}:${ip}`,
			budgets.hourlyMax,
			CALL_RATE_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const content = formatTranscriptMessage(entries);
		if (!content) {
			// Whitespace-only entries — nothing worth a row.
			return c.json({ ok: true, stored: false });
		}

		// Exactly-once per call: the widget's two teardown paths (unmount fetch
		// and pagehide keepalive) can race, and a duplicate system row would read
		// as two calls in the inbox. reserveOnce FAILS CLOSED on a STATE outage —
		// there, dropping a transcript beats risking duplicates, and the call
		// itself is still on record via the mint breadcrumb.
		const fresh = await reserveOnce(
			c.env,
			`voice-transcript:${project.id}:${clientId}:${callId}`,
		);
		if (!fresh) {
			return c.json({ ok: true, stored: false });
		}

		// A visitor can call without ever typing — create the conversation so
		// the call still lands in the inbox. Identity (name/email) only ever
		// comes from the stored conversation row, never from this request.
		const { conversation: conv } = await findOrCreateConversation(
			c.env,
			project.id,
			clientId,
			{ ip, userAgent: c.req.header("user-agent") ?? "" },
		);

		await insertMessage(c.env, {
			conversationId: conv.id,
			role: "system",
			content,
		});

		c.executionCtx.waitUntil(
			captureEvent(c.env, {
				event: ANALYTICS_EVENTS.voiceCallTranscribed,
				distinctId: clientId,
				// CONTENT-FREE by contract: counts only, never transcript text.
				properties: {
					project_id: project.id,
					workspace_id: project.workspaceId,
					entry_count: entries.length,
				},
			}),
		);

		return c.json({ ok: true, stored: true });
	});
