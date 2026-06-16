import { Hono } from "hono";

import { db } from "@/lib/db";

import { conversation, eq, message } from "@llmchat/db";

import type { AppContext } from "@/env";

interface InboundPayload {
	to: string[];
	from: { address: string };
	subject?: string;
	text?: string;
	html?: string;
	headers?: Record<string, string>;
}

function parseInboundLocal(toAddress: string): string | null {
	const m = toAddress.match(/^reply\+([^@]+)@/);
	return m ? m[1]! : null;
}

export const inboundEmail = new Hono<AppContext>().post(
	"/webhooks/inbound-email",
	async (c) => {
		const payload = (await c.req.json()) as InboundPayload;
		const localPart = payload.to
			.map(parseInboundLocal)
			.find((v): v is string => v !== null);
		if (!localPart) {
			return c.json({ error: "no matching local part" }, 400);
		}
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.inboundEmailLocal, localPart),
		});
		if (!proj) {
			return c.json({ error: "project not found" }, 404);
		}

		const inReplyTo = payload.headers?.["In-Reply-To"]?.replace(/[<>]/g, "");
		let conv = inReplyTo
			? await db(c.env).query.conversation.findFirst({
					where: (ct, { and, eq: e, exists }) =>
						and(
							e(ct.projectId, proj.id),
							exists(
								db(c.env)
									.select()
									.from(message)
									.where(
										and(
											e(message.conversationId, ct.id),
											e(message.emailMessageId, inReplyTo),
										),
									),
							),
						),
				})
			: undefined;

		if (!conv) {
			conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and, eq: e }) =>
					and(e(ct.projectId, proj.id), e(ct.email, payload.from.address)),
				orderBy: (ct, { desc }) => desc(ct.updatedAt),
			});
		}

		if (!conv) {
			return c.json({ error: "conversation not found" }, 404);
		}

		const nextSeq = conv.messageCount + 1;
		await db(c.env)
			.insert(message)
			.values({
				conversationId: conv.id,
				role: "user",
				content: payload.text ?? payload.html ?? "",
				sequence: nextSeq,
			});
		await db(c.env)
			.update(conversation)
			.set({ messageCount: nextSeq, updatedAt: new Date() })
			.where(eq(conversation.id, conv.id));

		return c.json({ ok: true });
	},
);
