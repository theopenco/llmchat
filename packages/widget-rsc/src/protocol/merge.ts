import { ESCALATED_HOLDING_MESSAGE } from "./constants";

import type { ServerMessage } from "./api";
import type { ChatMessage } from "../types";

/** A message held only in local state (in flight / streaming / failed). */
export interface LocalMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

/**
 * Merge the persisted feed (source of truth, ordered by sequence — includes
 * operator replies) with local state (which alone knows about the in-flight
 * user message and the streaming assistant reply).
 *
 * Each local message is matched against one unconsumed server message with
 * the same role+content; matched ones are dropped (already persisted) and
 * rendered via the feed. Unmatched ones (still streaming / in flight) are
 * appended after the feed — EXCEPT the escalation holding ack.
 *
 * The holding ack is client-only (streamed, never persisted → never matches a
 * server row), so a plain tail-dump would float it to the BOTTOM, below later
 * operator replies and subsequent visitor turns. It's instead ANCHORED to the
 * server slot of the visitor message it acknowledges (its nearest preceding
 * matched local), so it renders in correct chronological order.
 *
 * Ported from the first-party script widget (packages/widget/src/messages-sync.ts
 * in github.com/theopenco/llmchat) so both embeds behave identically.
 */
export function mergeMessages(
	server: ServerMessage[],
	local: LocalMessage[],
): ChatMessage[] {
	const consumed = new Set<number>();
	// Match each local message to a server index (or -1 = unmatched), in local order.
	const matched: number[] = local.map((l) => {
		const idx = server.findIndex(
			(s, i) =>
				!consumed.has(i) && s.role === l.role && s.content === l.content,
		);
		if (idx >= 0) {
			consumed.add(idx);
		}
		return idx;
	});

	// Holding acks (unmatched assistant rows with the shared ack content) → keyed
	// by the server index they anchor after. Everything else unmatched → the tail.
	const anchored = new Map<number, ChatMessage[]>();
	const tail: ChatMessage[] = [];
	for (let i = 0; i < local.length; i++) {
		if (matched[i]! >= 0) {
			continue; // persisted → rendered via the feed
		}
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
				if (existing) {
					existing.push(l);
				} else {
					anchored.set(anchor, [l]);
				}
				continue;
			}
			// No preceding persisted message yet (transient, pre-poll) — tail for
			// now; it anchors once the visitor message lands in the feed.
		}
		tail.push(l);
	}

	const out: ChatMessage[] = [];
	server.forEach((s, i) => {
		out.push({
			id: s.id,
			role: s.role,
			content: s.content,
			rating: s.rating ?? null,
			// Only persisted assistant messages can be rated (stable DB id);
			// in-flight local messages can't until the feed catches up.
			rateable: s.role === "assistant",
		});
		const holds = anchored.get(i);
		if (holds) {
			out.push(...holds);
		}
	});
	return [...out, ...tail];
}
