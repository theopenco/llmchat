import type { DisplayMessage } from "./components/MessageList";

export interface ServerMessage {
	id: string;
	role: string;
	content: string;
	sequence: number;
	createdAt: number;
}

/** GET the persisted conversation feed; [] when none exists yet. */
export async function fetchMessages(
	apiUrl: string,
	projectKey: string,
	clientId: string,
	signal?: AbortSignal,
): Promise<ServerMessage[]> {
	const params = new URLSearchParams({ projectKey, clientId });
	const res = await fetch(`${apiUrl}/v1/messages?${params}`, { signal });
	if (!res.ok) {
		throw new Error(`messages failed: ${res.status}`);
	}
	const data = (await res.json()) as { messages: ServerMessage[] };
	return data.messages;
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
		...server.map((s) => ({ id: s.id, role: s.role, content: s.content })),
		...tail,
	];
}
