/**
 * Opaque keyset cursor for the conversation feed, ordered by
 * `(updatedAt DESC, id DESC)`. The token encodes the last row's sort key —
 * `updatedAt` as unix **seconds** (how the column is stored) plus the `id`
 * tiebreaker — so the next page resumes exactly after it, stable under inserts
 * (unlike OFFSET, which shifts when a new row lands at the top).
 *
 * The token is base64url of `"<epochSeconds>|<id>"`. It's opaque to clients:
 * decode is defensive and returns `null` for anything malformed, so a garbage
 * cursor just serves the first page rather than erroring mid-scroll.
 */
export interface ConversationCursor {
	/** unix seconds — matches the stored `updatedAt` integer. */
	updatedAt: number;
	id: string;
}

function toBase64Url(input: string): string {
	return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
	const padded = input
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(input.length / 4) * 4, "=");
	return atob(padded);
}

export function encodeCursor(cursor: ConversationCursor): string {
	return toBase64Url(`${cursor.updatedAt}|${cursor.id}`);
}

/**
 * Decode a cursor token. Returns `null` for any malformed input (bad base64,
 * missing separator, non-integer timestamp, empty id) so the caller can fall
 * back to the first page instead of 400-ing.
 */
export function decodeCursor(
	token: string | undefined,
): ConversationCursor | null {
	if (!token) return null;
	let raw: string;
	try {
		raw = fromBase64Url(token);
	} catch {
		return null;
	}
	const sep = raw.indexOf("|");
	if (sep === -1) return null;
	const updatedAt = Number(raw.slice(0, sep));
	const id = raw.slice(sep + 1);
	if (!Number.isInteger(updatedAt) || updatedAt < 0 || id.length === 0) {
		return null;
	}
	return { updatedAt, id };
}
