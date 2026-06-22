import type { Conversation } from "./types";

/** The inbox status filter — a query VIEW, not an exclusive state. Maps 1:1 to
 * the list endpoint's `status` param (open|resolved|escalated|all). */
export type StatusFilter = "open" | "resolved" | "escalated" | "all";

export const STATUS_FILTERS: ReadonlyArray<{
	value: StatusFilter;
	label: string;
}> = [
	{ value: "open", label: "Open" },
	{ value: "resolved", label: "Resolved" },
	{ value: "escalated", label: "Escalated" },
	{ value: "all", label: "All" },
];

/** The single status shown on a conversation's header pill. */
export type DerivedStatus = "open" | "resolved" | "escalated";

/**
 * Derive a conversation's display status from the only two real signals on the
 * row. Priority: **Resolved (archivedAt) > Escalated (escalatedAt) > Open** —
 * resolving (archiving) is the terminal/closed state, so it wins even if the
 * conversation was also escalated along the way. No status enum is invented;
 * these are derived, query-only views.
 */
export function deriveStatus(
	c: Pick<Conversation, "archivedAt" | "escalatedAt">,
): DerivedStatus {
	if (c.archivedAt) return "resolved";
	if (c.escalatedAt) return "escalated";
	return "open";
}

/** ck-token pill styling per derived status (label + classes). */
export const STATUS_PILL: Record<
	DerivedStatus,
	{ label: string; className: string }
> = {
	open: {
		label: "Open",
		className: "bg-ck-chip text-ck-muted",
	},
	escalated: {
		label: "Escalated",
		className: "bg-ck-warn/15 text-ck-warn",
	},
	resolved: {
		label: "Resolved",
		className: "bg-ck-accent/12 text-ck-accent",
	},
};
