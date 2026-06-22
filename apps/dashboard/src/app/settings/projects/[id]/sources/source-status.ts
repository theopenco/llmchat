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

/** Per-type source counts for the typed-source rollup cards — real data only. */
export function countByType(
	sources: Pick<Source, "kind">[],
): Record<SourceType, number> {
	const counts: Record<SourceType, number> = { URL: 0, "Q&A": 0, Text: 0 };
	for (const s of sources) counts[sourceType(s)] += 1;
	return counts;
}

/**
 * Truthful per-source item count for the Items column. Every source holds
 * exactly one item today — we fetch one page per URL, store one pair, one
 * snippet — so this reads "1 page" / "1 pair" / "1 snippet". It's the honest
 * base for the deep-crawl depth that will later let one URL source span many
 * pages; no fabricated "142 pages".
 */
export function sourceItemLabel(s: Pick<Source, "kind">): string {
	const t = sourceType(s);
	return t === "URL" ? "1 page" : t === "Q&A" ? "1 pair" : "1 snippet";
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
