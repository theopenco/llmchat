import { conversation } from "@llmchat/db";

import { db } from "@/lib/db";

import type { AppContext } from "@/env";

/**
 * The visitor's single conversation for a project, keyed (projectId, clientId)
 * — created on first contact. Shared by every public entry point that may be
 * a visitor's FIRST touch (chat turn, voice-call transcript), so they all
 * agree on what a conversation row looks like at birth.
 */
export async function findOrCreateConversation(
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
