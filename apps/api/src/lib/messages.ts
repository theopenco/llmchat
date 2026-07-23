import { conversation, eq, message, sql } from "@llmchat/db";

import { db } from "@/lib/db";

import type { Env } from "@/env";

export type MessageRow = typeof message.$inferSelect;

export interface InsertMessageInput {
	conversationId: string;
	role: MessageRow["role"];
	content: string;
	authorUserId?: string | null;
	/** RFC 5322 Message-ID seeding email threading. NEVER pass for notes —
	 * their exclusion from inbound-email matching is structural. */
	emailMessageId?: string | null;
	replyToMessageId?: string | null;
}

/** True for SQLite/D1 unique-constraint failures (the 0024 index tripping).
 * Walks the cause chain: drizzle 0.45 wraps EVERY driver error in
 * DrizzleQueryError ("Failed query: …") and the "UNIQUE constraint failed"
 * text lives only on err.cause — a message-only check never matches in prod. */
function isUniqueViolation(err: unknown): boolean {
	const seen = new Set<unknown>();
	for (let e: unknown = err; e && !seen.has(e); ) {
		seen.add(e);
		const msg = e instanceof Error ? e.message : String(e);
		if (/unique constraint failed/i.test(msg)) {
			return true;
		}
		e = (e as { cause?: unknown }).cause;
	}
	return false;
}

/**
 * THE single message writer (#146). Every conversation-message insert in the
 * api goes through here — never inline insert+bump in a route.
 *
 * - `sequence` is allocated ATOMICALLY by a scalar subquery inside the INSERT
 *   itself (COALESCE(MAX(sequence),0)+1 for this conversation). D1/SQLite
 *   serialize writers per statement, so there is no read-then-write gap for a
 *   concurrent writer (operator reply, note, escalate marker, email reply,
 *   mid-stream assistant persist) to race — the old protocol precomputed
 *   messageCount+1 at request time and collided exactly there.
 * - `messageCount` is DECOUPLED from allocation: a commutative
 *   message_count = message_count + 1 (never an absolute assignment, which
 *   silently absorbed concurrent bumps). It stays the row count consumers
 *   rely on (unread watermarks, summary staleness, list display), and the
 *   UPDATE's RETURNING hands back the post-bump count so callers (escalate
 *   analytics) never re-derive it from a sequence.
 * - On a unique-constraint failure (the (conversation_id, sequence) index
 *   that migration 0024 — PR-C, deployed AFTER this code — will enforce;
 *   impossible once every writer self-allocates, kept as a tripwire) the
 *   insert retries ONCE with a log line; the re-run subquery picks the next
 *   free slot.
 */
export async function insertMessage(
	env: Env,
	input: InsertMessageInput,
): Promise<{ row: MessageRow; messageCount: number }> {
	const attempt = () =>
		db(env)
			.insert(message)
			.values({
				conversationId: input.conversationId,
				role: input.role,
				content: input.content,
				authorUserId: input.authorUserId ?? null,
				emailMessageId: input.emailMessageId ?? null,
				replyToMessageId: input.replyToMessageId ?? null,
				sequence: sql`(SELECT COALESCE(MAX(${message.sequence}), 0) + 1 FROM ${message} WHERE ${message.conversationId} = ${input.conversationId})`,
			})
			.returning();

	let rows: MessageRow[];
	try {
		rows = await attempt();
	} catch (err) {
		if (!isUniqueViolation(err)) {
			throw err;
		}
		console.error(
			"insertMessage: unique sequence collision, retrying once",
			{ conversationId: input.conversationId, role: input.role },
			err,
		);
		rows = await attempt();
	}

	const bumped = await db(env)
		.update(conversation)
		.set({
			messageCount: sql`${conversation.messageCount} + 1`,
			updatedAt: new Date(),
		})
		.where(eq(conversation.id, input.conversationId))
		.returning({ messageCount: conversation.messageCount });

	return { row: rows[0], messageCount: bumped[0]?.messageCount ?? 0 };
}
