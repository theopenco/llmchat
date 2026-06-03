import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildReplyToAddress, escapeHtml, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/kv";
import { streamChat } from "@/lib/llm";

import {
	conversation,
	eq,
	message as messageTable,
	usageEvent,
} from "@llmchat/db";

import type { AppContext } from "@/env";
import type { UIMessage } from "ai";

const chatBody = z.object({
	projectKey: z.string(),
	clientId: z.string(),
	name: z.string().optional(),
	email: z
		.union([z.email(), z.literal("")])
		.optional()
		.transform((v) => v || undefined),
	messages: z.array(z.any()),
});

const escalateBody = z.object({
	projectKey: z.string(),
	clientId: z.string(),
	name: z.string().optional(),
	email: z
		.union([z.email(), z.literal("")])
		.optional()
		.transform((v) => v || undefined),
	messages: z.array(z.object({ role: z.string(), content: z.string() })),
});

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 60;

function clientIp(c: { req: { header(name: string): string | undefined } }) {
	return (
		c.req.header("cf-connecting-ip") ??
		c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

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
		return existing;
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
	return created!;
}

export const chat = new Hono<AppContext>()
	.post("/chat", zValidator("json", chatBody), async (c) => {
		const { projectKey, clientId, name, email, messages } = c.req.valid("json");
		const project = await loadProject(c.env, projectKey);
		if (!project) {
			return c.json({ error: "invalid project key" }, 404);
		}

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

		const conv = await findOrCreateConversation(c.env, project.id, clientId, {
			name,
			email,
			ip,
			userAgent: c.req.header("user-agent") ?? "",
		});

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

		const result = await streamChat(c.env, {
			model: project.model,
			systemPrompt: activePromptContent,
			knowledgeText: project.knowledgeText,
			sources: activeSources.map((s) => ({
				title: s.title || s.url,
				url: s.url,
				content: s.content,
			})),
			messages: messages as UIMessage[],
		});

		c.executionCtx.waitUntil(
			(async () => {
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
				await db(c.env)
					.insert(usageEvent)
					.values({
						workspaceId: project.workspaceId,
						projectId: project.id,
						conversationId: conv.id,
						messageId: "",
						model: project.model,
						promptTokens: usage?.inputTokens ?? 0,
						completionTokens: usage?.outputTokens ?? 0,
						costUsd: 0,
					});
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
		const conv = await db(c.env).query.conversation.findFirst({
			where: (ct, { and, eq: e }) =>
				and(e(ct.projectId, project.id), e(ct.clientId, clientId)),
		});
		if (!conv) {
			return c.json({ error: "no conversation" }, 404);
		}
		await db(c.env)
			.update(conversation)
			.set({
				escalatedAt: new Date(),
				name: name ?? conv.name,
				email: email ?? conv.email,
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
			await sendEmail(c.env, {
				to: project.notifyEmail,
				subject: `New escalation from ${name ?? "anonymous"}`,
				html: `<p>Conversation escalated.</p>${transcriptHtml}`,
				replyTo: buildReplyToAddress(c.env, project.inboundEmailLocal),
			});
		}

		return c.json({ ok: true });
	});
