import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { meterEventName } from "@/lib/billing-config";
import {
	buildTranscript,
	SUMMARY_MIN_MESSAGES,
} from "@/lib/conversation-summary";
import { db } from "@/lib/db";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import {
	ESCALATED_HOLDING_MESSAGE,
	holdingStreamResponse,
} from "@/lib/holding";
import { buildIntegrationTools } from "@/lib/integration-tools";
import { publicLookupRateLimit, rateLimit, shouldSendHolding } from "@/lib/kv";
import { streamChat, summarizeForVisitor } from "@/lib/llm";
import { isResponseBlocked, resolveAccess } from "@/lib/plan";
import { captureEvent, captureInBackground } from "@/lib/posthog";
import { clientIp } from "@/lib/request";
import { sendEscalationSlack } from "@/lib/slack";
import { reportMeterEvent } from "@/lib/stripe";

import {
	and as andWhere,
	conversation,
	eq,
	isNull,
	message as messageTable,
	usageEvent,
} from "@llmchat/db";
import {
	ANALYTICS_EVENTS,
	DEFAULT_MODEL,
	effectiveModel,
	isModelAllowed,
	isPaidPlan,
	planEntitlements,
} from "@llmchat/shared";

import type { AppContext } from "@/env";
import type { UIMessage } from "ai";

const optionalEmail = z
	.union([z.email(), z.literal("")])
	.optional()
	.transform((v) => v || undefined);

// Per-message content cap — bounds the attacker-controlled text pushed into the
// model on the SHARED operator key (mirrors escalate's 8k content cap, adapted
// to the UIMessage {role, parts:[{type,text}]} shape). Array length stays at
// 200; each message's text parts cap at 8k, with a sane parts-count ceiling.
const MAX_MESSAGE_TEXT = 8_000;
const MAX_MESSAGE_PARTS = 100;

const chatBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	name: z.string().max(200).optional(),
	email: optionalEmail,
	messages: z
		.array(z.any())
		.max(200)
		.refine(
			(msgs) =>
				msgs.every((m) => {
					const parts = (m as { parts?: unknown })?.parts;
					if (parts === undefined) return true;
					if (!Array.isArray(parts) || parts.length > MAX_MESSAGE_PARTS)
						return false;
					return parts.every((p) => {
						const text = (p as { text?: unknown })?.text;
						return typeof text !== "string" || text.length <= MAX_MESSAGE_TEXT;
					});
				}),
			{ message: "message content exceeds the size limit" },
		),
});

const escalateBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	name: z.string().max(200).optional(),
	email: optionalEmail,
	messages: z
		.array(
			z.object({ role: z.string().max(32), content: z.string().max(8_000) }),
		)
		.max(200),
});

// Visitor-resolve identifies its own conversation by (projectKey, clientId) —
// never a client-trusted conversation id (tenant-safe, mirrors /v1/escalate).
const resolveBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
});

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 60;
// Escalations trigger notification emails — keep the budget much tighter.
const ESCALATE_RATE_LIMIT_MAX = 5;
// Visitor-resolve is a cheap idempotent DB write (no email/Slack); modest cap.
const RESOLVE_RATE_LIMIT_MAX = 10;
// Hard ceiling on the in-chat visitor recap generation so a slow/hung gpt-5-nano
// call can never delay the escalate response. On timeout the recap is dropped
// (summary: null) — the escalation itself is already recorded.
const VISITOR_SUMMARY_TIMEOUT_MS = 4_500;

async function loadProject(env: AppContext["Bindings"], publicKey: string) {
	const p = await db(env).query.project.findFirst({
		where: (pt, { eq: e }) => e(pt.publicKey, publicKey),
	});
	return p ?? null;
}

async function findOrCreateConversation(
	env: AppContext["Bindings"],
	projectId: string,
	clientId: string,
	meta: { name?: string; email?: string; ip: string; userAgent: string },
) {
	const existing = await db(env).query.conversation.findFirst({
		where: (ct, { and, eq: e }) =>
			and(e(ct.projectId, projectId), e(ct.clientId, clientId)),
	});
	if (existing) {
		return { conversation: existing, created: false };
	}
	const [created] = await db(env)
		.insert(conversation)
		.values({
			projectId,
			clientId,
			name: meta.name,
			email: meta.email,
			ipAddress: meta.ip,
			userAgent: meta.userAgent,
			messageCount: 0,
		})
		.returning();
	return { conversation: created!, created: true };
}

export const chat = new Hono<AppContext>()
	.post("/chat", zValidator("json", chatBody), async (c) => {
		const { projectKey, clientId, name, email, messages } = c.req.valid("json");

		// Per-IP gate BEFORE the project lookup: bounds DB load from floods of
		// invalid/unknown project keys (the per-project limits below only kick in
		// once a key resolves). Fails open — public widget path.
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const project = await loadProject(c.env, projectKey);
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

		// Resolve the owning workspace's access: plan, entitlements, Stripe
		// customer, and whether it's an exempt internal/founder workspace.
		const { exempt, plan, stripeCustomerId } = await resolveAccess(
			c.env,
			project.workspaceId,
		);

		const rl = await rateLimit(
			c.env,
			`chat:${project.id}:${ip}`,
			RATE_LIMIT_MAX,
			RATE_LIMIT_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		// Paywall — build-first-then-pay. Exempt workspaces always serve. Everyone
		// else: a workspace with no active subscription can BUILD an agent but its
		// live agent serves nothing until they subscribe (subscription_required);
		// a subscribed workspace hard-stops only when a fixed tier hits its monthly
		// cap (message_limit_reached) — overage tiers are never blocked here.
		// Checked BEFORE any DB write so a blocked workspace persists nothing.
		// Quota check fails OPEN (see isResponseBlocked).
		if (!exempt) {
			if (!isPaidPlan(plan)) {
				return c.json({ error: "subscription_required" }, 402);
			}
			if (await isResponseBlocked(c.env, project.workspaceId, plan)) {
				return c.json({ error: "message_limit_reached" }, 402);
			}
		}

		const { conversation: conv, created: convCreated } =
			await findOrCreateConversation(c.env, project.id, clientId, {
				name,
				email,
				ip,
				userAgent: c.req.header("user-agent") ?? "",
			});

		c.executionCtx.waitUntil(
			(async () => {
				if (convCreated) {
					await captureEvent(c.env, {
						event: ANALYTICS_EVENTS.conversationStarted,
						distinctId: clientId,
						properties: {
							project_id: project.id,
							workspace_id: project.workspaceId,
						},
					});
				}
				await captureEvent(c.env, {
					event: ANALYTICS_EVENTS.widgetMessageSent,
					distinctId: clientId,
					properties: { project_id: project.id, role: "user" },
				});
			})(),
		);

		const lastUser = messages[messages.length - 1] as UIMessage;
		const userText = lastUser?.parts
			?.filter((p): p is { type: "text"; text: string } => p.type === "text")
			.map((p) => p.text)
			.join("");
		const nextSeq = conv.messageCount + 1;
		await db(c.env)
			.insert(messageTable)
			.values({
				conversationId: conv.id,
				role: "user",
				content: userText ?? "",
				sequence: nextSeq,
			});
		// Bump the count with the user message now — if the model call below
		// fails, the next message must not reuse this sequence.
		await db(c.env)
			.update(conversation)
			.set({ messageCount: nextSeq, updatedAt: new Date() })
			.where(eq(conversation.id, conv.id));

		// Holding-message guard: a human is in the loop (escalated and not yet
		// resolved), so the bot must NOT answer over the handoff. The visitor message
		// is already persisted above (the operator sees it) and messageCount is
		// bumped, so returning here only skips the model call + the post-stream
		// waitUntil — NO assistant row, NO usageEvent, NO Stripe meter: a muted turn
		// is free. The bot stays muted in BOTH branches below (neither calls the model).
		// The reopen latch (unarchive leaves escalatedAt set) is a ticketed follow-up.
		if (conv.escalatedAt && !conv.archivedAt) {
			// Once an operator (role "admin") has actually replied, a human owns the
			// conversation and is responding directly — so SUPPRESS the automated
			// "we'll follow up" ack too: re-serving it while a human is actively
			// replying is contradictory. Go fully silent (empty stream, no bubble); the
			// visitor sees the operator's real replies via /v1/messages polling. The ack
			// only fires while no human (admin) reply exists yet — the waiting gap (so an
			// operator who replied before escalation suppresses even the first ack, which
			// is correct: a human is already engaged). Evaluate the
			// throttle LAZILY (only in the no-admin branch) so this admin-replied path
			// never dirties the STATE cooldown timestamp.
			const adminReplied = await db(c.env).query.message.findFirst({
				where: (m, { and, eq: e }) =>
					and(e(m.conversationId, conv.id), e(m.role, "admin")),
				columns: { id: true },
			});
			if (adminReplied) {
				return holdingStreamResponse(null);
			}
			const send = await shouldSendHolding(c.env, conv.id);
			return holdingStreamResponse(send ? ESCALATED_HOLDING_MESSAGE : null);
		}

		let activePromptContent = project.systemPrompt;
		const activePromptId = project.activeSystemPromptId;
		if (activePromptId) {
			const active = await db(c.env).query.systemPrompt.findFirst({
				where: (sp, { and: a, eq: e }) =>
					a(e(sp.id, activePromptId), e(sp.projectId, project.id)),
			});
			if (active) activePromptContent = active.content;
		}

		const activeSources = await db(c.env).query.source.findMany({
			where: (s, { and: a, eq: e }) =>
				a(e(s.projectId, project.id), e(s.active, true)),
		});

		// Enabled integrations become agent tools (Cal.com scheduling, Shopify
		// order actions). Null for the common no-integration case — the model
		// call stays byte-identical to pre-integration behavior.
		const integrationRows = await db(c.env).query.integration.findMany({
			where: (i, { and: a, eq: e }) =>
				a(e(i.projectId, project.id), e(i.enabled, true)),
		});
		const built = buildIntegrationTools({
			rows: integrationRows,
			identity: { name: conv.name, email: conv.email },
			onAction: (kind, toolName, ok) =>
				captureInBackground(c, {
					event: ANALYTICS_EVENTS.integrationActionUsed,
					distinctId: clientId,
					properties: {
						project_id: project.id,
						workspace_id: project.workspaceId,
						kind,
						tool: toolName,
						ok,
					},
				}),
		});

		// Guard the live bot against a project stuck on a model that's no longer
		// a valid web-search model (e.g. a pre-web-search saved value): run the
		// default for this request instead of letting the gateway call fail.
		let model = effectiveModel(project.model);
		if (model !== project.model) {
			console.warn(
				`chat: project ${project.id} model "${project.model}" is not a web-search model; using "${model}"`,
			);
		}
		// Tier model-access safety net: if the saved model isn't allowed on the
		// current plan (e.g. a Growth→Starter downgrade left the project on a
		// premium model), degrade to the basic default rather than serve a model
		// they no longer pay for — and never take the live agent down with a 402.
		// Exempt workspaces run any model.
		if (!exempt && !isModelAllowed(plan, model)) {
			console.warn(
				`chat: project ${project.id} model "${model}" not allowed on plan "${plan}"; using "${DEFAULT_MODEL}"`,
			);
			model = DEFAULT_MODEL;
		}

		let result: Awaited<ReturnType<typeof streamChat>>;
		try {
			result = await streamChat(c.env, {
				model,
				systemPrompt: activePromptContent,
				knowledgeText: project.knowledgeText,
				sources: activeSources.map((s) => ({
					// qa/text sources have no url; fall back to the title for the label
					// and pass "" for the (now-optional) url so buildSystem omits it.
					title: s.title || s.url || "",
					url: s.url ?? "",
					content: s.content,
				})),
				// Surface the already-identified visitor from the STORED conversation
				// columns (set once at creation, not re-read from each turn's body) so the
				// agent never re-asks for contact details on file. Anonymous (null/null)
				// conversations inject nothing.
				identity: { name: conv.name, email: conv.email },
				...(built
					? { tools: built.tools, actionsBlock: built.actionsBlock }
					: {}),
				messages: messages as UIMessage[],
			});
		} catch (err) {
			// The visitor message is already persisted (the conversation shows up
			// in the inbox either way) — a model/gateway failure should surface as
			// a friendly retry in the widget, not an unhandled 500.
			console.error("chat: model call failed", err);
			return c.json({ error: "assistant unavailable" }, 502);
		}

		c.executionCtx.waitUntil(
			(async () => {
				try {
					const text = await result.text;
					// totalUsage sums every step — with integration tools a turn can
					// span several model steps, and metering must count all of them.
					// Identical to `usage` for the single-step (no-tools) path.
					const usage = await result.totalUsage;
					await db(c.env)
						.insert(messageTable)
						.values({
							conversationId: conv.id,
							role: "assistant",
							content: text,
							sequence: nextSeq + 1,
						});
					await db(c.env)
						.update(conversation)
						.set({ messageCount: nextSeq + 1, updatedAt: new Date() })
						.where(eq(conversation.id, conv.id));
					const [event] = await db(c.env)
						.insert(usageEvent)
						.values({
							workspaceId: project.workspaceId,
							projectId: project.id,
							conversationId: conv.id,
							messageId: "",
							model,
							promptTokens: usage?.inputTokens ?? 0,
							completionTokens: usage?.outputTokens ?? 0,
							costUsd: 0,
						})
						.returning({ id: usageEvent.id });

					// Overage metering: report this billable response to Stripe for
					// tiers that allow overage. Stripe's metered price applies the
					// included free quota, so we report EVERY response. Best-effort —
					// a meter fault must never affect the already-served reply; the
					// usageEvent id is the idempotency key so a retry can't double-bill.
					const { STRIPE_SECRET_KEY } = c.env.vars;
					if (
						!exempt &&
						planEntitlements(plan).allowOverage &&
						stripeCustomerId &&
						STRIPE_SECRET_KEY?.trim()
					) {
						try {
							await reportMeterEvent(STRIPE_SECRET_KEY, {
								eventName: meterEventName(c.env.vars),
								customerId: stripeCustomerId,
								value: 1,
								identifier: event?.id,
							});
						} catch (err) {
							console.error("chat: overage meter report failed", err);
						}
					}
				} catch (err) {
					// Stream failed — the user message and count are already
					// persisted; there is just no assistant reply to store.
					console.error("chat: failed to persist assistant message", err);
				}
			})(),
		);

		return result.toUIMessageStreamResponse();
	})
	.post("/escalate", zValidator("json", escalateBody), async (c) => {
		// `messages` is intentionally ignored: the operator notification transcript
		// is rebuilt from stored rows below, never from this (forgeable) body.
		const { projectKey, clientId, name, email } = c.req.valid("json");

		// Per-IP gate BEFORE the project lookup — bounds invalid-key DB floods.
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const project = await loadProject(c.env, projectKey);
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		const rl = await rateLimit(
			c.env,
			`escalate:${project.id}:${ip}`,
			ESCALATE_RATE_LIMIT_MAX,
			RATE_LIMIT_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and, eq: e }) =>
				and(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});
		if (!conv) {
			return c.json({ error: "no conversation" }, 404);
		}
		// Idempotent escalation: if already escalated, do nothing again — no duplicate
		// system row, no escalatedAt re-stamp, no operator email/Slack, and skip the
		// visitor-recap generation. A reloading visitor whose session-local "escalated"
		// flag reset can re-POST /v1/escalate; this stops it re-firing notifications.
		// (The widget also hydrates escalatedAt from /v1/messages to hide the CTA; this
		// is the server-side backstop for races that hydration can't cover.)
		if (conv.escalatedAt) {
			return c.json({ ok: true, summary: null, alreadyEscalated: true });
		}
		// DB first: the escalation must be recorded and visible in the inbox
		// regardless of whether any notification below succeeds.
		const systemSeq = conv.messageCount + 1;
		// Seed the email thread: stamp the system message with a Message-ID so a
		// reply to the customer acknowledgement (sent below) threads back into this
		// conversation via In-Reply-To. Only meaningful when inbound email is
		// configured, so it's gated on INBOUND_EMAIL_DOMAIN.
		const ackMessageId = c.env.vars.INBOUND_EMAIL_DOMAIN
			? `${crypto.randomUUID()}@${c.env.vars.INBOUND_EMAIL_DOMAIN}`
			: null;
		await db(c.env).insert(messageTable).values({
			conversationId: conv.id,
			role: "system",
			content: "Visitor requested a human operator",
			sequence: systemSeq,
			emailMessageId: ackMessageId,
		});
		await db(c.env)
			.update(conversation)
			.set({
				escalatedAt: new Date(),
				name: name ?? conv.name,
				email: email ?? conv.email,
				messageCount: systemSeq,
				updatedAt: new Date(),
			})
			.where(eq(conversation.id, conv.id));

		// Rebuild the transcript from STORED messages (ordered by sequence), not the
		// caller-supplied body. Fetched unconditionally — the operator email needs it
		// (forgery-safe contents) AND the visitor recap below needs it even when no
		// operator email is configured.
		const rows = await db(c.env).query.message.findMany({
			where: (mt, { eq: e }) => e(mt.conversationId, conv.id),
			orderBy: (mt, { asc }) => asc(mt.sequence),
		});

		// Start the visitor-facing recap now so the gpt-5-nano call overlaps the email
		// round-trips below; it's awaited (timeout-bounded) just before the response.
		// The escalation is ALREADY durably recorded above, so a slow/failed/empty
		// recap can never fail or hang the visitor's human request. Exclude system rows
		// (the "Visitor requested a human operator" marker) so the recap summarizes the
		// conversation, not the escalation event; the operator email keeps every row.
		// Gate on a real exchange (parity with the inbox path) so a thin chat isn't
		// padded into a vacuous recap.
		const recapRows = rows.filter(
			(m) => m.role !== "system" && m.content.trim(),
		);
		const summaryPromise: Promise<string | null> =
			recapRows.length >= SUMMARY_MIN_MESSAGES
				? Promise.race([
						summarizeForVisitor(c.env, buildTranscript(recapRows)).catch(
							() => null,
						),
						new Promise<null>((resolve) =>
							setTimeout(() => resolve(null), VISITOR_SUMMARY_TIMEOUT_MS),
						),
					])
				: Promise.resolve(null);

		if (project.notifyEmail) {
			const transcriptHtml = rows
				.map(
					(m) =>
						`<p><b>${escapeHtml(m.role)}:</b> ${escapeHtml(m.content)}</p>`,
				)
				.join("");
			try {
				await sendEmail(c.env, {
					to: project.notifyEmail,
					subject: `New escalation from ${name ?? "anonymous"}`,
					html: `<p>Conversation escalated.</p>${transcriptHtml}`,
					replyTo: buildReplyToAddress(c.env, project.inboundEmailLocal),
				});
			} catch (err) {
				// The escalation is already recorded and visible in the inbox; a
				// failed notification email must not fail the visitor's request.
				console.error("escalate: notification email failed", err);
			}
		}

		// Acknowledge the customer so they know a human will follow up, and seed
		// the email thread so their reply lands back in this conversation. Gated
		// on the visitor having an email, inbound email being configured (so the
		// Message-ID exists), and a deliverable reply-to (so replies are captured).
		const visitorEmail = email ?? conv.email;
		const ackReplyTo = buildReplyToAddress(c.env, project.inboundEmailLocal);
		if (visitorEmail && ackMessageId && ackReplyTo) {
			try {
				await sendEmail(c.env, {
					to: visitorEmail,
					subject: `Re: your message to ${project.name}`,
					html:
						`<p>Thanks for reaching out to ${escapeHtml(project.name)} — ` +
						`a member of our team will get back to you shortly.</p>` +
						`<p>You can reply directly to this email and your message ` +
						`will be added to the conversation.</p>`,
					text:
						`Thanks for reaching out to ${project.name} — a member of our ` +
						`team will get back to you shortly.\n\nYou can reply directly ` +
						`to this email and your message will be added to the conversation.`,
					replyTo: ackReplyTo,
					headers: { "Message-ID": `<${ackMessageId}>` },
				});
			} catch (err) {
				// Best-effort: a failed acknowledgement must not fail escalation.
				console.error("escalate: customer acknowledgement email failed", err);
			}
		}

		c.executionCtx.waitUntil(
			captureEvent(c.env, {
				event: ANALYTICS_EVENTS.conversationEscalated,
				distinctId: clientId,
				properties: {
					project_id: project.id,
					workspace_id: project.workspaceId,
					notified: !!project.notifyEmail,
					message_count: systemSeq,
				},
			}),
		);
		// Slack notification runs post-response and is failure-tolerant, so it
		// never blocks or breaks the escalation (no-op when no webhook is set).
		c.executionCtx.waitUntil(sendEscalationSlack(c.env, project, conv.id));

		// Resolve the recap last (it overlapped the email sends). Never throws —
		// both race members are failure-guarded — and is null on any error/timeout/
		// empty, so the widget simply shows no card. Escalation already succeeded.
		const summary = await summaryPromise;
		return c.json({ ok: true, summary });
	})
	.post("/resolve", zValidator("json", resolveBody), async (c) => {
		const { projectKey, clientId } = c.req.valid("json");

		// Per-IP gate BEFORE the project lookup — bounds invalid-key DB floods.
		const ip = clientIp(c);
		const gate = await publicLookupRateLimit(c.env, ip);
		if (!gate.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}

		const project = await loadProject(c.env, projectKey);
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		const rl = await rateLimit(
			c.env,
			`resolve:${project.id}:${ip}`,
			RESOLVE_RATE_LIMIT_MAX,
			RATE_LIMIT_WINDOW,
		);
		if (!rl.ok) {
			return c.json({ error: "rate limit exceeded" }, 429);
		}
		// Tenant-safe: the visitor's own conversation, by (projectId, clientId) —
		// never a client-supplied id. Banked rule: and(), never bare eq().
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and, eq: e }) =>
				and(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});
		if (!conv) {
			return c.json({ error: "no conversation" }, 404);
		}
		// Idempotent: already resolved → no-op (mirrors escalate's alreadyEscalated).
		// A reloading visitor whose session-local "resolved" flag reset can re-POST;
		// this stops a second archivedAt re-stamp.
		if (conv.archivedAt) {
			return c.json({ ok: true, resolved: true, alreadyResolved: true });
		}
		// Decision B — protect the bug-3 holding guard. A human is handling an
		// escalated conversation, so a VISITOR must NOT resolve it: setting
		// archivedAt would flip the `escalatedAt && !archivedAt` guard false and let
		// the bot answer over the live handoff. The operator closes escalated chats
		// from the dashboard instead. Benign 200 no-op (NOT 409/500) so a race —
		// visitor taps Resolve just as escalation lands — settles cleanly: the
		// widget re-polls and shows the escalated state instead of an error band.
		if (conv.escalatedAt) {
			return c.json({ ok: true, resolved: false, reason: "escalated" });
		}
		// Atomic with the Decision B guard: archive ONLY while not escalated. The
		// read-time `if (conv.escalatedAt)` above gives the friendly response in the
		// common case; this `isNull(escalatedAt)` write predicate closes the TOCTOU
		// window where a concurrent /v1/escalate stamps escalatedAt between the
		// findFirst and this update — without it a visitor-set archivedAt on a
		// just-escalated row would flip the holding guard (`escalatedAt &&
		// !archivedAt`, chat.ts) false and un-mute the bot over a live handoff.
		const updated = await db(c.env)
			.update(conversation)
			.set({
				archivedAt: new Date(),
				resolvedBy: "visitor",
				updatedAt: new Date(),
			})
			.where(
				andWhere(
					eq(conversation.id, conv.id),
					isNull(conversation.escalatedAt),
				),
			)
			.returning({ id: conversation.id });
		if (updated.length === 0) {
			// A concurrent escalation won the race — leave the bot muted; the widget
			// re-polls /v1/messages and shows the escalated state.
			return c.json({ ok: true, resolved: false, reason: "escalated" });
		}
		c.executionCtx.waitUntil(
			captureEvent(c.env, {
				event: ANALYTICS_EVENTS.conversationResolved,
				distinctId: clientId,
				properties: {
					project_id: project.id,
					workspace_id: project.workspaceId,
					resolved_by: "visitor",
				},
			}),
		);
		return c.json({ ok: true, resolved: true });
	});
