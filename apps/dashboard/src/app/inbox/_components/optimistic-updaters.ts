import type { Conversation, Message } from "./types";

interface ThreadData {
	conversation: Conversation;
	messages: Message[];
}

/**
 * Build the optimistic admin message appended to a thread the instant an agent
 * hits send — the same shape the server echoes back, with a temp id so the real
 * row (a different id) cleanly replaces it on reconcile. Role "admin" is what
 * makes stick-to-bottom treat the reply as the agent's own send and follow to
 * the bottom (it never yanks for inbound visitor/bot messages).
 *
 * Pure, immutable, and undefined-safe — matches the `apply` contract of
 * `useOptimisticMutation` so a failed send rolls the thread straight back.
 */
export function appendOptimisticReply(
	prev: unknown,
	reply: { tempId: string; content: string; createdAt: string },
): unknown {
	if (!prev || typeof prev !== "object") return prev;
	const data = prev as ThreadData;
	if (!Array.isArray(data.messages)) return prev;
	const nextSeq = (data.messages.at(-1)?.sequence ?? 0) + 1;
	const optimistic: Message = {
		id: reply.tempId,
		role: "admin",
		content: reply.content,
		sequence: nextSeq,
		createdAt: reply.createdAt,
		rating: null,
	};
	return { ...data, messages: [...data.messages, optimistic] };
}

/**
 * Same contract as appendOptimisticReply, for an internal note: the amber card
 * appears the instant the operator hits "Add note", stamped with their own name
 * (the reconciled server row carries the joined authorName). Like "admin",
 * role "note" is one of the own-send roles in MessageThread's sendKey, so the
 * thread follows your note to the bottom even when you'd scrolled up.
 */
export function appendOptimisticNote(
	prev: unknown,
	note: {
		tempId: string;
		content: string;
		createdAt: string;
		authorName: string | null;
	},
): unknown {
	if (!prev || typeof prev !== "object") return prev;
	const data = prev as ThreadData;
	if (!Array.isArray(data.messages)) return prev;
	const nextSeq = (data.messages.at(-1)?.sequence ?? 0) + 1;
	const optimistic: Message = {
		id: note.tempId,
		role: "note",
		content: note.content,
		sequence: nextSeq,
		createdAt: note.createdAt,
		rating: null,
		authorName: note.authorName,
	};
	return { ...data, messages: [...data.messages, optimistic] };
}
