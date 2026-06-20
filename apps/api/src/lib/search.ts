import { sql } from "@llmchat/db";

import type { AnyColumn, SQL } from "drizzle-orm";

/**
 * Inbox content search helpers. The strategy is a deliberately simple, scoped
 * `LIKE '%term%'` contains-scan — no full-text-search infra — which is the right
 * call at this volume (a leading-wildcard LIKE can't use a B-tree index anyway,
 * so an index on message.content would not help; FTS5 is the future path if
 * volume ever demands it).
 */

/** Upper bound on how many message-matching conversations we gather for one
 * search, so a broad term can't drag back an unbounded id set before we paginate
 * the conversation list. Generous for this volume. */
export const MAX_MATCH_CONVERSATIONS = 500;

/**
 * Escape the LIKE metacharacters in a user term so it matches *literally*. `%`
 * and `_` are SQL wildcards and `\` is our escape char — without this, a term
 * containing `%` would silently match everything. Pair with `ESCAPE '\'` (see
 * {@link likeContains}).
 */
export function escapeLike(term: string): string {
	return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * A case-insensitive "column contains term" SQL condition. The term is passed as
 * a **bound parameter** (never string-concatenated into SQL — no injection), and
 * wildcards are escaped so the match is literal. SQLite's LIKE is ASCII
 * case-insensitive, which is what we want for names/emails/message bodies.
 */
export function likeContains(column: AnyColumn, term: string): SQL {
	const pattern = `%${escapeLike(term)}%`;
	return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/** Case-insensitive substring test, mirroring {@link likeContains} on the JS
 * side so the route can classify which field matched (name vs email) and the
 * snippet builder can locate the hit. */
export function includesCI(haystack: string, needle: string): boolean {
	return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Build a short, single-line snippet of `content` centered on the first
 * occurrence of `term`, with `…` marking clipped ends. Whitespace (incl.
 * newlines) is collapsed so a multi-line message reads as a tidy preview. The
 * result is **plain text** — the caller is responsible for safe rendering
 * (escaped) and for highlighting the term.
 */
export function buildSnippet(
	content: string,
	term: string,
	radius = 48,
): string {
	const text = content.replace(/\s+/g, " ").trim();
	const idx = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;

	// No locatable hit (e.g. the term used a LIKE wildcard): fall back to a head
	// excerpt so we still show context.
	if (idx === -1) {
		const head = text.slice(0, radius * 2).trim();
		return head.length < text.length ? `${head}…` : head;
	}

	const start = Math.max(0, idx - radius);
	const end = Math.min(text.length, idx + term.length + radius);
	let snippet = text.slice(start, end).trim();
	if (start > 0) snippet = `…${snippet}`;
	if (end < text.length) snippet = `${snippet}…`;
	return snippet;
}
