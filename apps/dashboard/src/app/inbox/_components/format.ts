// Presentation helpers for the inbox. Kept pure (no React) so they're unit
// tested directly and shared across the list, thread, and detail panel.

/**
 * Normalize a timestamp from the API into a Date. The API serializes Drizzle
 * `timestamp` columns as ISO strings, but this tolerates unix seconds/millis
 * too so a representation change can't render "Invalid Date".
 */
export function toDate(
	value: string | number | Date | null | undefined,
): Date | null {
	if (value == null || value === "") return null;
	if (value instanceof Date) return value;
	if (typeof value === "number") {
		return new Date(value < 1e12 ? value * 1000 : value);
	}
	const numeric = Number(value);
	if (value.trim() !== "" && !Number.isNaN(numeric)) {
		return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
	}
	return new Date(value);
}

/** Short relative age for list rows, e.g. "just now", "5m", "3h", "2d". */
export function timeAgo(
	value: string | number | null | undefined,
	now = Date.now(),
): string {
	const date = toDate(value);
	if (!date) return "";
	const minutes = Math.floor((now - date.getTime()) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d`;
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Full date for the detail panel, e.g. "June 16, 2026, 05:00 AM". */
export function formatFullDate(
	value: string | number | null | undefined,
): string {
	const date = toDate(value);
	if (!date) return "—";
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Wall-clock time for a message bubble, e.g. "05:00 AM". */
export function formatMessageTime(
	value: string | number | null | undefined,
): string {
	const date = toDate(value);
	if (!date) return "";
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function parseBrowser(ua: string): string {
	if (ua.includes("Firefox")) return "Firefox";
	if (ua.includes("Edg/")) return "Edge";
	if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
	if (ua.includes("Chrome")) return "Chrome";
	if (ua.includes("Safari")) return "Safari";
	return "Unknown browser";
}

function parseOS(ua: string): string {
	if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
	if (ua.includes("Android")) return "Android";
	if (ua.includes("Windows")) return "Windows";
	if (ua.includes("Mac OS")) return "macOS";
	if (ua.includes("Linux")) return "Linux";
	return "Unknown OS";
}

/** A friendly "Chrome on macOS" from a raw user-agent; null when unknown. */
export function parseDevice(
	userAgent: string | null | undefined,
): string | null {
	if (!userAgent) return null;
	return `${parseBrowser(userAgent)} on ${parseOS(userAgent)}`;
}

/** "1 message", "3 messages" — pluralizes a noun by count. */
export function pluralize(
	count: number,
	singular: string,
	plural = `${singular}s`,
): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

/** Up-to-2-letter avatar initials from a name; "?" when there's no name. */
export function initials(name: string | null | undefined): string {
	const trimmed = name?.trim();
	if (!trimmed) return "?";
	return trimmed
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}
