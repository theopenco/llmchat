/** True for SQLite/D1 unique-constraint failures (the 0024 sequence index, the
 * member_workspace_user index, …). Walks the cause chain: drizzle 0.45 wraps
 * EVERY driver error in DrizzleQueryError ("Failed query: …") and the "UNIQUE
 * constraint failed" text lives only on err.cause — a message-only check never
 * matches in prod. */
export function isUniqueViolation(err: unknown): boolean {
	const seen = new Set<unknown>();
	for (let e: unknown = err; e && !seen.has(e); ) {
		seen.add(e);
		const msg = e instanceof Error ? e.message : String(e);
		if (/unique constraint failed/i.test(msg)) {
			return true;
		}
		e = (e as { cause?: unknown }).cause;
	}
	return false;
}
