export interface Conversation {
	id: string;
	clientId: string;
	name: string | null;
	email: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	messageCount: number;
	escalatedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	/** End-of-conversation CSAT (1–5 stars); null when the visitor didn't rate.
	 * Distinct from per-message thumbs (Message.rating). */
	csatRating: number | null;
	/** First visitor message, used as the list preview (added by the list API). */
	firstMessage?: string | null;
	/** True when the current user hasn't seen the latest messages. */
	unread?: boolean;
	/** Why this conversation matched the active search: an excerpt + which field
	 * it came from. Present only on search responses; null when nothing matched on
	 * text (added by the list API). The snippet is plain text — render escaped. */
	match?: SearchMatch | null;
}

/** Where a search term was found, with a short plain-text excerpt for context. */
export interface SearchMatch {
	field: "body" | "name" | "email";
	snippet: string;
}

export interface Message {
	id: string;
	role: "user" | "assistant" | "admin" | "system";
	content: string;
	sequence: number;
	createdAt: string;
	/** Visitor thumbs rating on an assistant reply (answer quality); null/absent
	 * = unrated. Distinct from per-conversation CSAT. */
	rating?: "up" | "down" | null;
}
