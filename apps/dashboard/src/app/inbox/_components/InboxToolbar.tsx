"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import { TagFilter } from "./TagFilter";
import type { Tag } from "./types";

export interface InboxToolbarProps {
	search: string;
	onSearch: (value: string) => void;
	/** Active vs archived view — the only real conversation filter we have. */
	showArchived: boolean;
	onShowArchivedChange: (archived: boolean) => void;
	/** Workspace tags for the toolbar tag filter. */
	tags: Tag[];
	/** Selected tag ids (OR filter). */
	tagIds: string[];
	onTagIdsChange: (ids: string[]) => void;
}

/**
 * Top toolbar spanning the inbox panes: status filter + search + a real tag
 * filter (in the slot the disabled "Filters" placeholder used to occupy). The
 * list is always ordered latest-first, so the "Latest" label is truthful. PR2
 * will unify all of these into one filter surface.
 */
export function InboxToolbar({
	search,
	onSearch,
	showArchived,
	onShowArchivedChange,
	tags,
	tagIds,
	onTagIdsChange,
}: InboxToolbarProps) {
	return (
		<div className="flex items-center gap-2 border-b px-4 py-2.5">
			<Select
				value={showArchived ? "archived" : "all"}
				onValueChange={(v) => onShowArchivedChange(v === "archived")}
			>
				<SelectTrigger
					className="h-9 w-[11rem] shrink-0"
					aria-label="Filter conversations"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All conversations</SelectItem>
					<SelectItem value="archived">Archived</SelectItem>
				</SelectContent>
			</Select>

			<div className="relative min-w-0 flex-1">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(e) => onSearch(e.target.value)}
					placeholder="Search conversations…"
					aria-label="Search conversations"
					className="h-9 pl-9"
				/>
			</div>

			<TagFilter tags={tags} selectedIds={tagIds} onChange={onTagIdsChange} />
			<span className="hidden shrink-0 px-1 text-sm text-muted-foreground sm:inline">
				Sort: <span className="font-medium text-foreground">Latest</span>
			</span>
		</div>
	);
}
