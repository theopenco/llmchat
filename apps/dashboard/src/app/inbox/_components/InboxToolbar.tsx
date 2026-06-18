"use client";

import { Search, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface InboxToolbarProps {
	search: string;
	onSearch: (value: string) => void;
	/** Active vs archived view — the only real conversation filter we have. */
	showArchived: boolean;
	onShowArchivedChange: (archived: boolean) => void;
}

/**
 * Top toolbar spanning the inbox panes: status filter + search are real and
 * drive the list. "Filters" and "Sort" are clearly-disabled placeholders — there
 * is no filter/sort backend yet, and the list is always ordered latest-first
 * (so the "Latest" label is truthful, not a fabricated control).
 */
export function InboxToolbar({
	search,
	onSearch,
	showArchived,
	onShowArchivedChange,
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

			{/* Placeholders: no filter/sort backend yet. Disabled so they read as
			    not-yet-available rather than fabricating behavior. */}
			<button
				type="button"
				disabled
				title="Advanced filters aren't available yet"
				className="inline-flex h-9 shrink-0 cursor-not-allowed items-center gap-1.5 rounded-md border px-3 text-sm text-muted-foreground opacity-60"
			>
				<SlidersHorizontal className="size-4" />
				Filters
			</button>
			<span className="hidden shrink-0 px-1 text-sm text-muted-foreground sm:inline">
				Sort: <span className="font-medium text-foreground">Latest</span>
			</span>
		</div>
	);
}
