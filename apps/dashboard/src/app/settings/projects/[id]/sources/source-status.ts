import type { Source } from "../types";

/** The source's kind, shown as the Type column chip. Real `kind` column. */
export type SourceType = "URL" | "Q&A" | "Text";

export function sourceType(s: Pick<Source, "kind">): SourceType {
	return s.kind === "qa" ? "Q&A" : s.kind === "text" ? "Text" : "URL";
}

/**
 * Sync status, derived from real columns only — never a fabricated
 * "crawling/queued". URL sources are fetched, so they have a fetch lifecycle;
 * Q&A/Text aren't crawled (no URL), so their status is just "Saved".
 *   - error      -> the last fetch failed (lastError)
 *   - off        -> the source is disabled (!active)
 *   - saved      -> a non-URL source (qa/text) — nothing to crawl
 *   - pending    -> a URL with no successful fetch yet
 *   - ready      -> a URL fetched OK (lastFetchedAt)
 */
export type SourceStatus = "error" | "off" | "saved" | "pending" | "ready";

export function sourceStatus(
	s: Pick<Source, "kind" | "url" | "active" | "lastError" | "lastFetchedAt">,
): SourceStatus {
	if (s.lastError) return "error";
	if (!s.active) return "off";
	if (s.kind !== "url") return "saved";
	if (!s.lastFetchedAt) return "pending";
	return "ready";
}

/** ck-token chip styling per status (label + classes). */
export const STATUS_STYLE: Record<
	SourceStatus,
	{ label: string; className: string }
> = {
	ready: { label: "Ready", className: "bg-ck-accent/12 text-ck-accent" },
	pending: { label: "Pending", className: "bg-ck-warn/15 text-ck-warn" },
	error: { label: "Failed", className: "bg-ck-warn/15 text-ck-warn" },
	off: { label: "Off", className: "bg-ck-chip text-ck-faint" },
	saved: { label: "Saved", className: "bg-ck-chip text-ck-muted" },
};
