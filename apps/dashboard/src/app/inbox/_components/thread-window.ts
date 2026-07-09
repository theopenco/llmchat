import type { AgentActionEntry, Conversation, Message } from "./types";

/** Page size for the message thread. Also the threshold: a conversation with
 * this many messages or fewer loads in one shot (hasOlder=false) and behaves
 * exactly as the pre-pagination thread did. */
export const THREAD_PAGE_SIZE = 50;

/** The server's thread response (latest page, an older `before` page, or the
 * newest-only `after` poll). `firstHitSequence` is present only on a search
 * fetch — the sequence of the oldest message matching the term. */
export interface ThreadResponse {
	conversation: Conversation;
	messages: Message[];
	hasOlder: boolean;
	firstHitSequence?: number | null;
	/** Durable agent-action audit trail for this conversation (full set per
	 * fetch, bounded server-side). Absent on older clients / empty conversations. */
	agentActions?: AgentActionEntry[];
}

/** The contiguous window the inbox holds for the open conversation. */
export interface ThreadWindow {
	conversation: Conversation;
	messages: Message[];
	hasOlder: boolean;
	/** Sequence of the first search hit (null = none / not searching). Preserved
	 * across poll/load-older merges; only a fresh search fetch updates it. */
	firstHitSequence: number | null;
	/** Agent-action audit trail, refreshed from the latest fetch. */
	agentActions: AgentActionEntry[];
}

function sortBySequence(messages: Message[]): Message[] {
	return [...messages].sort((a, b) => a.sequence - b.sequence);
}

/** Union two message lists by id, ascending by sequence. Append (poll) and
 * prepend (older) never overlap in practice, but dedup keeps it safe. */
function unionById(a: Message[], b: Message[]): Message[] {
	const seen = new Set(a.map((m) => m.id));
	return sortBySequence([...a, ...b.filter((m) => !seen.has(m.id))]);
}

export function minSequence(messages: Message[]): number | null {
	return messages.length ? messages[0].sequence : null;
}

export function maxSequence(messages: Message[]): number | null {
	return messages.length ? messages[messages.length - 1].sequence : null;
}

/** Build the latest window from a fresh fetch (initial open or search). */
export function toWindow(res: ThreadResponse): ThreadWindow {
	return {
		conversation: res.conversation,
		messages: sortBySequence(res.messages),
		hasOlder: res.hasOlder,
		firstHitSequence: res.firstHitSequence ?? null,
		agentActions: res.agentActions ?? [],
	};
}

/**
 * Poll merge: append newer messages and refresh the conversation (status, csat),
 * leaving `hasOlder` and `firstHitSequence` untouched. Undefined-safe.
 */
export function appendNewer(
	prev: ThreadWindow | undefined,
	res: ThreadResponse,
): ThreadWindow | undefined {
	if (!prev) return prev;
	return {
		...prev,
		conversation: res.conversation,
		messages: unionById(prev.messages, res.messages),
		// The endpoint returns the full per-conversation action set each fetch, so
		// the newest poll response carries any action taken since the last tick.
		agentActions: res.agentActions ?? prev.agentActions,
	};
}

/**
 * Load-older merge: prepend the older page and adopt its `hasOlder`. The newest
 * message (last id) is unchanged, so stick-to-bottom never treats this as new
 * content. Undefined-safe.
 */
export function prependOlder(
	prev: ThreadWindow | undefined,
	res: ThreadResponse,
): ThreadWindow | undefined {
	if (!prev) return prev;
	return {
		...prev,
		messages: unionById(res.messages, prev.messages),
		hasOlder: res.hasOlder,
	};
}

/** Query string for a thread fetch. `after` = poll (newest only); `before` =
 * older page; neither = latest page. `search` asks for firstHitSequence. */
export function threadParams(opts: {
	limit?: number;
	before?: number;
	after?: number;
	search?: string;
}): string {
	const params = new URLSearchParams();
	if (opts.after !== undefined) {
		params.set("after", String(opts.after));
		return params.toString();
	}
	params.set("limit", String(opts.limit ?? THREAD_PAGE_SIZE));
	if (opts.before !== undefined) params.set("before", String(opts.before));
	if (opts.search) params.set("search", opts.search);
	return params.toString();
}
