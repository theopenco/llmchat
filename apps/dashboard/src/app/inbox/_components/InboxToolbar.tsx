"use client";

import { Search } from "lucide-react";

import { Segmented } from "@/components/ds";

import { STATUS_FILTERS, type StatusFilter } from "./status";
import { TagFilter } from "./TagFilter";
import type { Tag } from "./types";

export interface InboxToolbarProps {
	search: string;
	onSearch: (value: string) => void;
	/** Derived status view: Open / Resolved / Escalated / All. */
	status: StatusFilter;
	onStatusChange: (status: StatusFilter) => void;
	/** Workspace tags for the toolbar tag filter. */
	tags: Tag[];
	/** Selected tag ids (OR filter). */
	tagIds: string[];
	onTagIdsChange: (ids: string[]) => void;
	/** Opens the manage-tags dialog (admin/owner only; omit to hide the link). */
	onManageTags?: () => void;
}

/**
 * Top toolbar spanning the inbox panes: the derived status filter (Open /
 * Resolved / Escalated / All), search, and the tag filter. Status is query-only
 * — Resolved == archived, Escalated == escalatedAt — never a fabricated state.
 */
export function InboxToolbar({
	search,
	onSearch,
	status,
	onStatusChange,
	tags,
	tagIds,
	onTagIdsChange,
	onManageTags,
}: InboxToolbarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-ck-border px-4 py-2.5">
			<Segmented
				options={STATUS_FILTERS}
				value={status}
				onChange={onStatusChange}
				aria-label="Filter conversations by status"
			/>

			<div className="relative min-w-0 flex-1">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ck-faint" />
				<input
					value={search}
					onChange={(e) => onSearch(e.target.value)}
					placeholder="Search conversations…"
					aria-label="Search conversations"
					className="h-9 w-full rounded-[10px] border border-ck-border bg-ck-card pl-9 pr-3 text-sm text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent"
				/>
			</div>

			<TagFilter
				tags={tags}
				selectedIds={tagIds}
				onChange={onTagIdsChange}
				onManage={onManageTags}
			/>
		</div>
	);
}
