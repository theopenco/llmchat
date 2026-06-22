"use client";

import { Check, Settings2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { Tag } from "./types";

export interface TagFilterProps {
	tags: Tag[];
	/** Currently-selected tag ids (OR filter). */
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	/** When provided (admin/owner), shows a "Manage tags" link in the footer. */
	onManage?: () => void;
}

/**
 * Multi-select tag filter for the toolbar (OR semantics — show conversations
 * with ANY selected tag). Lives where the disabled "Filters" placeholder was;
 * PR2 will unify all inbox filters, so this stays intentionally lightweight.
 */
export function TagFilter({
	tags,
	selectedIds,
	onChange,
	onManage,
}: TagFilterProps) {
	const [open, setOpen] = useState(false);
	const selected = new Set(selectedIds);
	const count = selectedIds.length;

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onChange([...next]);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={cn(
						"h-9 shrink-0 gap-1.5",
						count > 0 && "border-ck-accent/40 text-ck-text",
					)}
					// Disabled only when there are no tags to filter by.
					disabled={tags.length === 0}
				>
					<SlidersHorizontal className="size-4" />
					Tags
					{count > 0 && (
						<span className="ml-0.5 grid min-w-4 place-items-center rounded-full bg-ck-accent px-1 text-[10px] font-semibold text-white">
							{count}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-0" align="end">
				<Command>
					<CommandInput placeholder="Filter by tag…" />
					<CommandList>
						<CommandEmpty>No tags yet.</CommandEmpty>
						<CommandGroup>
							{tags.map((tag) => (
								<CommandItem
									key={tag.id}
									value={tag.name}
									onSelect={() => toggle(tag.id)}
									className="gap-2"
								>
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: tag.color ?? "#6b7280" }}
									/>
									<span className="flex-1 truncate">{tag.name}</span>
									{typeof tag.count === "number" && (
										<span className="text-[10px] tabular-nums text-ck-faint">
											{tag.count}
										</span>
									)}
									<Check
										className={cn(
											"size-3.5 shrink-0",
											selected.has(tag.id) ? "opacity-100" : "opacity-0",
										)}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
				{(count > 0 || onManage) && (
					<div className="flex items-center justify-between gap-1 border-t border-ck-border p-1">
						{onManage ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="gap-1.5 text-xs text-ck-faint"
								onClick={() => {
									setOpen(false);
									onManage();
								}}
							>
								<Settings2 className="size-3.5" />
								Manage tags
							</Button>
						) : (
							<span />
						)}
						{count > 0 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs text-ck-faint"
								onClick={() => onChange([])}
							>
								Clear {count}
							</Button>
						)}
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
