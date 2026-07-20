import { conversation, eq } from "@llmchat/db";
import { VISITOR_VISIBLE_ROLES } from "@llmchat/shared";

import { db } from "@/lib/db";
import { summarizeConversation } from "@/lib/llm";

import type { Env } from "@/env";

/** One full exchange (visitor + reply) before a conversation is worth a summary;
 * below this the inbox shows the message snippet. */
export const SUMMARY_MIN_MESSAGES = 2;
/** Regenerate only once the conversation has advanced by a full exchange since
 * the cached summary — cost-aware (per-exchange, never per-message). */
export const SUMMARY_STALE_DELTA = 2;
/** Cap generations enqueued per inbox list fetch so the first load can't fan out
 * a page's worth of gateway calls at once; the rest drain on later loads. */
export const SUMMARY_PER_REQUEST_CAP = 8;
/** Per-conversation cooldown (seconds) that also dedupes concurrent list fetches.
 * The deployed state binding exposes only get/set (no put/TTL), so expiry is
 * tracked in the stored value, mirroring lib/kv.ts. */
const SUMMARY_COOLDOWN_SECONDS = 90;
/** Chars of transcript handed to the model (~1.5k tokens). */
const TRANSCRIPT_CHAR_BUDGET = 6_000;

/** Is the cached summary missing or stale enough to (re)generate? Pure. */
export function summaryIsStale(c: {
	messageCount: number;
	summary: string | null;
	summaryMessageCount: number | null;
}): boolean {
	if (c.messageCount < SUMMARY_MIN_MESSAGES) return false;
	if (c.summary === null || c.summaryMessageCount === null) return true;
	return c.messageCount - c.summaryMessageCount >= SUMMARY_STALE_DELTA;
}

/** Role-labeled, length-bounded transcript: the opener (intent) is always kept,
 * the recent tail (current state) fills the rest of the budget. Pure. */
export function buildTranscript(
	messages: { role: string; content: string }[],
): string {
	const label = (r: string) =>
		r === "user" ? "Visitor" : r === "system" ? "System" : "Agent";
	const lines = messages
		.filter((m) => m.content.trim())
		.map((m) => `${label(m.role)}: ${m.content.trim().replace(/\s+/g, " ")}`);
	if (lines.length === 0) return "";
	const joined = lines.join("\n");
	if (joined.length <= TRANSCRIPT_CHAR_BUDGET) return joined;
	// Cap the opener too, so a single huge first message can't blow the budget.
	const head = lines[0].slice(0, TRANSCRIPT_CHAR_BUDGET);
	const tailBudget = Math.max(0, TRANSCRIPT_CHAR_BUDGET - head.length - 2);
	const tail = lines.slice(1).join("\n").slice(-tailBudget);
	return `${head}\n…\n${tail}`;
}

/** Generate + persist a summary for one conversation. On generation failure
 * writes NOTHING (the inbox keeps the snippet). Writes NO usageEvent — internal
 * triage aid, off the customer's quota and billing. */
async function generateAndStore(
	env: Env,
	conv: { id: string; messageCount: number },
): Promise<void> {
	const msgs = await db(env).query.message.findMany({
		// Summaries describe the visitor conversation — the allowlist keeps
		// operator-internal notes (and any future role) out of the LLM prompt,
		// where buildTranscript would otherwise mislabel them "Agent".
		where: (m, { and: a, eq: e, inArray: inA }) =>
			a(e(m.conversationId, conv.id), inA(m.role, [...VISITOR_VISIBLE_ROLES])),
		orderBy: (m, { asc }) => [asc(m.sequence)],
		columns: { role: true, content: true },
	});
	const summary = await summarizeConversation(env, buildTranscript(msgs));
	if (!summary) return;
	await db(env)
		.update(conversation)
		.set({ summary, summaryMessageCount: conv.messageCount })
		.where(eq(conversation.id, conv.id));
}

/** Best-effort dedup/cooldown around generation using the state binding (get/set
 * only). Skips if this conversation was summarized within the cooldown; fails
 * OPEN (a state outage must not block the summary). Intended for waitUntil. */
export async function maybeSummarize(
	env: Env,
	conv: { id: string; messageCount: number },
): Promise<void> {
	const key = `summ:${conv.id}`;
	const now = Math.floor(Date.now() / 1000);
	try {
		const raw = await env.STATE.get(key);
		if (raw) {
			const ts = Number(raw);
			if (ts && now - ts < SUMMARY_COOLDOWN_SECONDS) return;
		}
		await env.STATE.set(key, String(now));
	} catch {
		// State unavailable — generate anyway rather than skip.
	}
	try {
		await generateAndStore(env, conv);
	} catch (err) {
		// Detached (runs in waitUntil): swallow so a transient DB fault never
		// surfaces as an unhandled rejection — the inbox just keeps the snippet
		// until a later load retries.
		console.warn("maybeSummarize: generation failed", err);
	}
}
