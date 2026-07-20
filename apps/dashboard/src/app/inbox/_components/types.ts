/** A workspace label. `count` is present only on the /tags list aggregate. */
export interface Tag {
	id: string;
	name: string;
	color: string | null;
	count?: number;
}

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
	/** Who resolved the conversation: "visitor" (clicked Resolve in the widget),
	 * "admin" (operator resolved here), or null for legacy/un-attributed resolves
	 * → render a plain "Resolved" with no actor. Optional so existing fixtures
	 * needn't set it. */
	resolvedBy?: string | null;
	createdAt: string;
	updatedAt: string;
	/** Tags attached to this conversation (added by the list API; [] when none). */
	tags?: Tag[];
	/** End-of-conversation CSAT (1–5 stars); null when the visitor didn't rate.
	 * Distinct from per-message thumbs (Message.rating). */
	csatRating: number | null;
	/** First visitor message, used as the list preview (added by the list API). */
	firstMessage?: string | null;
	/** One-line AI triage summary (added by the list API; null until generated).
	 * Preferred over firstMessage in the preview; null → snippet fallback. */
	summary?: string | null;
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

/** True project-wide totals for the inbox header (server aggregate, not
 * loaded-page counts). `avgRating` is null when no conversation is rated. */
export interface ConversationStats {
	total: number;
	escalated: number;
	resolved: number;
	avgRating: number | null;
}

export interface Message {
	id: string;
	/** "note" = operator-internal annotation — dashboard-thread only; the api
	 * excludes it from every visitor/model/email surface. */
	role: "user" | "assistant" | "admin" | "system" | "note";
	content: string;
	sequence: number;
	createdAt: string;
	/** Author of operator-authored rows (admin replies, notes); null/absent for
	 * visitor/bot/system rows. */
	authorUserId?: string | null;
	/** Display name resolved by the thread API; null when the authoring account
	 * was deleted (render a generic fallback). */
	authorName?: string | null;
	/** Visitor thumbs rating on an assistant reply (answer quality); null/absent
	 * = unrated. Distinct from per-conversation CSAT. */
	rating?: "up" | "down" | null;
	/** Quote-reply: the id of the earlier message in this conversation the visitor
	 * was replying to; null/absent when the message isn't a reply. Resolved against
	 * the loaded window — a target in an unloaded older page renders a neutral chip. */
	replyToMessageId?: string | null;
}

/** A durable record of an action the AGENT took on this conversation (Cal.com
 * booking, Shopify order lookup / return). Operator-visible audit trail so a
 * mistaken or abusive action can be seen (and reversed in Shopify/Cal.com). */
export interface AgentActionEntry {
	id: string;
	kind: "calcom" | "shopify";
	tool: string;
	ok: boolean;
	detail: string | null;
	createdAt: number;
}
