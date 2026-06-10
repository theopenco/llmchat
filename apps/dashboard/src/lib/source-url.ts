/** Pure helpers for the knowledge-source URL field. Kept framework-free so they
 * can be unit-tested and reused by any caller (form, future bulk import, etc). */

export type SourceUrlError = "empty" | "invalid" | "protocol";

/**
 * Validate a user-entered source URL. Returns `null` when the value is a usable
 * http(s) URL, otherwise a reason code. Non-http(s) schemes (`javascript:`,
 * `file:`, `data:`) are rejected so they can never reach the crawler.
 */
export function validateSourceUrl(value: string): SourceUrlError | null {
	const trimmed = value.trim();
	if (!trimmed) return "empty";
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return "invalid";
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return "protocol";
	}
	return null;
}

export const SOURCE_URL_ERRORS: Record<
	Exclude<SourceUrlError, "empty">,
	string
> = {
	invalid: "Enter a valid URL (include https://)",
	protocol: "Only http(s) URLs are supported",
};

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Compact "time ago" label for an ISO timestamp, relative to `now` (injectable
 * so tests are deterministic). Returns "never" for a null/empty value.
 */
export function formatRelativeTime(
	iso: string | null,
	now: number = Date.now(),
): string {
	if (!iso) return "never";
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "never";
	const diff = now - then;
	if (diff < 0) return "just now";
	if (diff < MINUTE) return "just now";
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
	if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
	return `${Math.floor(diff / DAY)}d ago`;
}
