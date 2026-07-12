import { ESCALATED_HOLDING_MESSAGE } from "@llmchat/shared/holding";

import type { DisplayMessage } from "./components/MessageList";
import type { Rating } from "./rating";

export interface ServerMessage {
	id: string;
	role: string;
	content: string;
	sequence: number;
	createdAt: number;
	rating?: Rating;
	/** Quote-reply: the id of the earlier message in this conversation this one
	 * replies to (server-validated at write time). Null when it isn't a reply. */
	replyToMessageId?: string | null;
}

export interface MessageFeed {
	/** The visitor's own conversation id (null until one exists), used to
	 * address messages for rating. */
	conversationId: string | null;
	/** Conversation-level CSAT (1–5), null until rated. Lets the widget avoid
	 * re-prompting an already-rated visitor. */
	csatRating: number | null;
	/** When the conversation was escalated to a human (ISO string from the
	 * server), or null. Lets the widget hydrate "escalated" on reload so it hides
	 * the "Talk to a human" CTA and never re-fires /v1/escalate. */
	escalatedAt: string | number | null;
	/** When the conversation was resolved/archived (ISO string from the server),
	 * or null. Lets the widget hydrate "resolved" on reload so it hides the
	 * "Mark resolved" button and shows the resolved notice. */
	archivedAt: string | number | null;
	messages: ServerMessage[];
}

/** GET the persisted conversation feed; empty when none exists yet. */
export async function fetchMessages(
	apiUrl: string,
	projectKey: string,
	clientId: string,
	signal?: AbortSignal,
): Promise<MessageFeed> {
	const params = new URLSearchParams({ projectKey, clientId });
	const res = await fetch(`${apiUrl}/v1/messages?${params}`, { signal });
	if (!res.ok) {
		throw new Error(`messages failed: ${res.status}`);
	}
	const data = (await res.json()) as Partial<MessageFeed>;
	return {
		conversationId: data.conversationId ?? null,
		csatRating: data.csatRating ?? null,
		escalatedAt: data.escalatedAt ?? null,
		archivedAt: data.archivedAt ?? null,
		messages: data.messages ?? [],
	};
}

/**
 * Merge the persisted feed (source of truth, ordered by sequence — includes
 * admin replies) with the local useChat state (which alone knows about the
 * in-flight user message and the streaming assistant reply).
 *
 * Each local message is matched against one unconsumed server message with the
 * same role+content; matched ones are dropped (already persisted) and rendered via
 * the feed. Unmatched ones (still streaming / in flight / failed) are appended
 * after the feed — EXCEPT the escalation holding ack.
 *
 * The holding ack is client-only (streamed, never persisted → never matches a
 * server row), so a plain tail-dump would float it to the BOTTOM, below later admin
 * replies and subsequent visitor turns. We instead ANCHOR it to the server slot of
 * the visitor message it acknowledges (its nearest preceding matched local), so it
 * renders in correct chronological order. Only the holding row is anchored — the
 * normal in-flight pair (just-sent user + streaming reply) legitimately tails.
 */
export function mergeMessages(
	server: ServerMessage[],
	local: DisplayMessage[],
): DisplayMessage[] {
	const consumed = new Set<number>();
	// Match each local message to a server index (or -1 = unmatched), in local order.
	const matched: number[] = local.map((l) => {
		const idx = server.findIndex(
			(s, i) =>
				!consumed.has(i) && s.role === l.role && s.content === l.content,
		);
		if (idx >= 0) consumed.add(idx);
		return idx;
	});

	// Holding acks (unmatched assistant rows with the shared ack content) → keyed by
	// the server index they anchor after. Everything else unmatched → the tail.
	const anchored = new Map<number, DisplayMessage[]>();
	const tail: DisplayMessage[] = [];
	for (let i = 0; i < local.length; i++) {
		if (matched[i]! >= 0) continue; // persisted → rendered via the feed
		const l = local[i]!;
		const isHolding =
			l.role === "assistant" && l.content === ESCALATED_HOLDING_MESSAGE;
		if (isHolding) {
			// Anchor = the server index of the nearest preceding matched local (the
			// visitor message this ack replied to).
			let anchor = -1;
			for (let j = i - 1; j >= 0; j--) {
				const m = matched[j]!;
				if (m >= 0) {
					anchor = m;
					break;
				}
			}
			if (anchor >= 0) {
				const existing = anchored.get(anchor);
				if (existing) existing.push(l);
				else anchored.set(anchor, [l]);
				continue;
			}
			// No preceding persisted message yet (transient, pre-poll) — tail for now;
			// it anchors once the visitor message lands in the feed.
		}
		tail.push(l);
	}

	const out: DisplayMessage[] = [];
	server.forEach((s, i) => {
		out.push({
			id: s.id,
			role: s.role,
			content: s.content,
			rating: s.rating ?? null,
			// Only persisted assistant messages can be rated (they have a stable
			// DB id); in-flight local messages can't until the feed catches up.
			rateable: s.role === "assistant",
			// Fields are copied EXPLICITLY here (no spread of `s`), so anything new on
			// ServerMessage is dropped from the rendered thread unless forwarded. The
			// quote chip would render optimistically and then vanish on the next poll.
			replyToMessageId: s.replyToMessageId ?? null,
		});
		const holds = anchored.get(i);
		if (holds) out.push(...holds);
	});
	return [...out, ...tail];
}
