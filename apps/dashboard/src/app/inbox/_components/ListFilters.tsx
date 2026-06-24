"use client";

import { Search, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

import { STATUS_FILTERS, type StatusFilter } from "./status";
import type { Tag } from "./types";

const FALLBACK_DOT = "#6b7280";

/**
 * ROADMAP status concepts from the target design we do NOT have (assignment +
 * AI-triage). Rendered as dimmed, non-interactive pills so the status row
 * matches the design's layout without faking a filter that does nothing. Our
 * real views (Open / Resolved / Escalated / All) stay live alongside them.
 */
const ROADMAP_STATUSES = ["Unassigned", "AI-handled"] as const;

function chipBase(active: boolean) {
	return cn(
		"inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
		active
			? "border-ck-accent bg-ck-accent text-white"
			: "border-ck-border bg-ck-card text-ck-muted hover:text-ck-text hover:border-ck-accent/40",
	);
}

/**
 * The inbox list-pane header + filters, stacked vertically to match the target
 * design: "Inbox" + a real total, the conversation search, the LIVE
 * filter-by-tag chip row (All + each real workspace tag), and the LIVE status
 * pills. The tag chips drive the same `tagIds` state the popover used to — this
 * is purely a presentation swap over the existing OR-filter engine.
 *
 * Honesty rail: the total is the real server aggregate (or nothing while it
 * loads — never a placeholder number); the tag chips are real workspace tags
 * (data-driven, never the design's sample labels); the two ROADMAP status pills
 * are visibly dimmed and inert.
 */
export function ListFilters({
	total,
	search,
	onSearch,
	status,
	onStatusChange,
	tags,
	tagIds,
	onTagIdsChange,
	onManageTags,
}: {
	/** Real project-wide total (server aggregate); undefined while loading. */
	total?: number;
	search: string;
	onSearch: (value: string) => void;
	status: StatusFilter;
	onStatusChange: (status: StatusFilter) => void;
	tags: Tag[];
	tagIds: string[];
	onTagIdsChange: (ids: string[]) => void;
	/** Admin/owner only — omit to hide the manage affordance. */
	onManageTags?: () => void;
}) {
	const selected = new Set(tagIds);

	function toggleTag(id: string) {
		onTagIdsChange(
			selected.has(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id],
		);
	}

	return (
		<div className="flex flex-col gap-3 border-b border-ck-border px-4 pb-3 pt-4">
			{/* Title + real total */}
			<div className="flex items-center justify-between gap-2">
				<h1 className="text-lg font-bold tracking-[-0.01em] text-ck-text">
					Inbox
				</h1>
				{total != null && (
					<span className="text-xs font-medium text-ck-faint tabular-nums">
						{total} total
					</span>
				)}
			</div>

			{/* Conversation search (LIVE) */}
			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ck-faint" />
				<input
					value={search}
					onChange={(e) => onSearch(e.target.value)}
					placeholder="Search conversations…"
					aria-label="Search conversations"
					className="h-9 w-full rounded-[10px] border border-ck-border bg-ck-card pl-9 pr-3 text-sm text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent"
				/>
			</div>

			{/* Filter by tag (LIVE) — All + real workspace tags */}
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-[11px] font-semibold uppercase tracking-wider text-ck-faint">
						Filter by tag
					</span>
					{onManageTags && (
						<button
							type="button"
							onClick={onManageTags}
							className="inline-flex items-center gap-1 text-[11px] font-medium text-ck-faint hover:text-ck-text"
						>
							<SlidersHorizontal className="size-3" />
							Manage
						</button>
					)}
				</div>
				<div className="flex flex-wrap gap-1.5">
					<button
						type="button"
						onClick={() => onTagIdsChange([])}
						aria-pressed={tagIds.length === 0}
						className={chipBase(tagIds.length === 0)}
					>
						All
					</button>
					{tags.map((tag) => {
						const active = selected.has(tag.id);
						return (
							<button
								key={tag.id}
								type="button"
								onClick={() => toggleTag(tag.id)}
								aria-pressed={active}
								className={chipBase(active)}
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: tag.color ?? FALLBACK_DOT }}
								/>
								<span className="max-w-[8rem] truncate">{tag.name}</span>
							</button>
						);
					})}
					{tags.length === 0 && (
						<span className="text-xs text-ck-faint">No tags yet</span>
					)}
				</div>
			</div>

			{/* Status (LIVE views + dimmed ROADMAP concepts) */}
			<div className="flex flex-col gap-1.5">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-ck-faint">
					Status
				</span>
				<div
					className="flex flex-wrap gap-1.5"
					role="radiogroup"
					aria-label="Filter conversations by status"
				>
					{STATUS_FILTERS.map((s) => {
						const active = status === s.value;
						return (
							<button
								key={s.value}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => onStatusChange(s.value)}
								className={chipBase(active)}
							>
								{s.label}
							</button>
						);
					})}
					{/* ROADMAP — dimmed, inert. Assignment + AI-triage aren't built; shown
					    so the layout matches the design, never wired to anything. */}
					{ROADMAP_STATUSES.map((label) => (
						<span
							key={label}
							aria-disabled="true"
							title="Coming soon"
							className="inline-flex h-7 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-ck-border px-3 text-xs font-medium text-ck-disabled"
						>
							{label}
							<span className="text-[9px] font-semibold uppercase tracking-wide text-ck-disabled">
								soon
							</span>
						</span>
					))}
				</div>
			</div>
		</div>
	);
}
