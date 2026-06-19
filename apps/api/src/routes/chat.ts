import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { meterEventName } from "@/lib/billing-config";
import { db } from "@/lib/db";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/kv";
import { streamChat } from "@/lib/llm";
import { isResponseBlocked, resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";
import { clientIp } from "@/lib/request";
import { sendEscalationSlack } from "@/lib/slack";
import { reportMeterEvent } from "@/lib/stripe";

import {
	conversation,
	eq,
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

const chatBody = z.object({
	projectKey: z.string().max(128),
	clientId: z.string().max(128),
	name: z.string().max(200).optional(),
	email: optionalEmail,
	messages: z.array(z.any()).max(200),
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

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 60;
// Escalations trigger notification emails — keep the budget much tighter.
const ESCALATE_RATE_LIMIT_MAX = 5;

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

		const ip = clientIp(c);
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
					title: s.title || s.url,
					url: s.url,
					content: s.content,
				})),
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
					const usage = await result.usage;
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
		const { projectKey, clientId, name, email, messages } = c.req.valid("json");
		const project = await loadProject(c.env, projectKey);
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}
		const rl = await rateLimit(
			c.env,
			`escalate:${project.id}:${clientIp(c)}`,
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
		// DB first: the escalation must be recorded and visible in the inbox
		// regardless of whether any notification below succeeds.
		const systemSeq = conv.messageCount + 1;
		await db(c.env).insert(messageTable).values({
			conversationId: conv.id,
			role: "system",
			content: "Visitor requested a human operator",
			sequence: systemSeq,
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

		if (project.notifyEmail) {
			const transcriptHtml = messages
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

		c.executionCtx.waitUntil(
			captureEvent(c.env, {
				event: ANALYTICS_EVENTS.conversationEscalated,
				distinctId: clientId,
				properties: {
					project_id: project.id,
					workspace_id: project.workspaceId,
					notified: !!project.notifyEmail,
					message_count: messages.length,
				},
			}),
		);
		// Slack notification runs post-response and is failure-tolerant, so it
		// never blocks or breaks the escalation (no-op when no webhook is set).
		c.executionCtx.waitUntil(sendEscalationSlack(c.env, project, conv.id));

		return c.json({ ok: true });
	});
