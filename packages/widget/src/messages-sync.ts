import type { DisplayMessage } from "./components/MessageList";
import type { Rating } from "./rating";

export interface ServerMessage {
	id: string;
	role: string;
	content: string;
	sequence: number;
	createdAt: number;
	rating?: Rating;
}

export interface MessageFeed {
	/** The visitor's own conversation id (null until one exists), used to
	 * address messages for rating. */
	conversationId: string | null;
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
		messages: data.messages ?? [],
	};
}

/**
 * Merge the persisted feed (source of truth, ordered by sequence — includes
 * admin replies) with the local useChat state (which alone knows about the
 * in-flight user message and the streaming assistant reply).
 *
 * Each local message is matched against one unconsumed server message with the
 * same role+content; matched ones are dropped (already persisted), unmatched
 * ones (still streaming / in flight / failed) are appended after the feed.
 */
export function mergeMessages(
	server: ServerMessage[],
	local: DisplayMessage[],
): DisplayMessage[] {
	const consumed = new Set<number>();
	const tail: DisplayMessage[] = [];
	for (const l of local) {
		const idx = server.findIndex(
			(s, i) =>
				!consumed.has(i) && s.role === l.role && s.content === l.content,
		);
		if (idx >= 0) {
			consumed.add(idx);
		} else {
			tail.push(l);
		}
	}
	return [
		...server.map((s) => ({
			id: s.id,
			role: s.role,
			content: s.content,
			rating: s.rating ?? null,
			// Only persisted assistant messages can be rated (they have a stable
			// DB id); in-flight local messages can't until the feed catches up.
			rateable: s.role === "assistant",
		})),
		...tail,
	];
}
