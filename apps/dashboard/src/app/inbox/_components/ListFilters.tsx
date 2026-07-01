"use client";

import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { pluralize } from "./format";
import { STATUS_FILTERS, type StatusFilter } from "./status";
import type { ConversationStats, Tag } from "./types";

const FALLBACK_DOT = "#6b7280";

/**
 * ROADMAP status concepts from the target design we do NOT have (assignment +
 * AI-triage). Rendered as dimmed, non-interactive pills so the filter panel
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

function iconBtn(active?: boolean) {
	return cn(
		"relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-ck-border transition-colors",
		active
			? "bg-ck-navhover text-ck-text"
			: "bg-ck-card text-ck-muted hover:bg-ck-navhover hover:text-ck-text",
	);
}

/**
 * The inbox list-pane header — Chatbase "Chat logs" style: a title + the real
 * conversation total, a compact toolbar (a Filters toggle + refresh), and the
 * conversation search. The tag + status FILTERS collapse behind the Filters
 * button (moved off the main rail so the list reads clean); they still drive the
 * same `tagIds` / `status` state — a presentation move only, over the existing
 * OR-filter engine.
 *
 * Honesty rail: the total is the real server aggregate (or nothing while it
 * loads — never a placeholder); the tag chips are real workspace tags (never the
 * design's sample labels); the two ROADMAP status pills are visibly dimmed/inert.
 */
export function ListFilters({
	stats,
	search,
	onSearch,
	status,
	onStatusChange,
	tags,
	tagIds,
	onTagIdsChange,
	onManageTags,
	onRefresh,
}: {
	/** Real project-wide aggregates (server-side); undefined while loading. */
	stats?: ConversationStats;
	search: string;
	onSearch: (value: string) => void;
	status: StatusFilter;
	onStatusChange: (status: StatusFilter) => void;
	tags: Tag[];
	tagIds: string[];
	onTagIdsChange: (ids: string[]) => void;
	/** Admin/owner only — omit to hide the manage affordance. */
	onManageTags?: () => void;
	/** Refetch the list + stats (toolbar refresh). */
	onRefresh?: () => void;
}) {
	const [filtersOpen, setFiltersOpen] = useState(false);
	const selected = new Set(tagIds);
	// Active-filter badge on the Filters toggle (status ≠ the default "open" view
	// counts as one).
	const activeCount = tagIds.length + (status === "open" ? 0 : 1);

	function toggleTag(id: string) {
		onTagIdsChange(
			selected.has(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id],
		);
	}

	return (
		<div className="flex flex-col gap-3 border-b border-ck-border px-4 pb-3 pt-4">
			<div className="flex items-start justify-between gap-2">
				<div>
					<h1 className="text-lg font-bold tracking-[-0.01em] text-ck-text">
						Inbox
					</h1>
					{stats && (
						<p className="mt-0.5 text-xs text-ck-faint">
							{pluralize(stats.total, "conversation")}
						</p>
					)}
				</div>

				<div className="flex items-center gap-1">
					<button
						type="button"
						aria-label="Filters"
						aria-expanded={filtersOpen}
						onClick={() => setFiltersOpen((v) => !v)}
						className={iconBtn(filtersOpen)}
					>
						<SlidersHorizontal className="size-4" />
						{activeCount > 0 && (
							<span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-ck-accent text-[9px] font-bold text-white">
								{activeCount}
							</span>
						)}
					</button>

					{onRefresh && (
						<button
							type="button"
							aria-label="Refresh"
							onClick={onRefresh}
							className={iconBtn()}
						>
							<RefreshCw className="size-4" />
						</button>
					)}
				</div>
			</div>

			{/* Conversation search (LIVE) */}
			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ck-faint" />
				<input
					value={search}
					onChange={(e) => onSearch(e.target.value)}
					placeholder="Search conversations…"
					aria-label="Search conversations"
					className="h-9 w-full rounded-[10px] border border-transparent bg-ck-chip pl-9 pr-3 text-sm text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent focus-visible:bg-ck-card"
				/>
			</div>

			{/* Filters — collapsed by default (moved off the main rail). */}
			{filtersOpen && (
				<div className="flex flex-col gap-4 rounded-[10px] border border-ck-border bg-ck-card p-3">
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
				</div>
			)}
		</div>
	);
}
