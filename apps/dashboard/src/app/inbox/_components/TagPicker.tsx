"use client";

import { Check, Plus, Tag as TagIcon } from "lucide-react";
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

export interface TagPickerProps {
	/** All workspace tags to search/toggle. */
	tags: Tag[];
	/** Ids currently attached to the open conversation. */
	attachedIds: string[];
	/** Toggle an existing tag on/off (optimistic in the caller). */
	onToggle: (tag: Tag) => void;
	/** Create-and-attach a brand-new tag (awaited in the caller). */
	onCreate: (name: string) => void;
	/** True while a create is in flight. */
	creating?: boolean;
}

/**
 * Tag combobox for the open conversation: search existing workspace tags, toggle
 * them on/off, or create a new one inline when nothing matches the query. Purely
 * presentational — attach/detach/create mutations live in the inbox page.
 */
export function TagPicker({
	tags,
	attachedIds,
	onToggle,
	onCreate,
	creating,
}: TagPickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const attached = new Set(attachedIds);

	const trimmed = query.trim();
	// Offer "Create" only when the typed name doesn't already exist (case-insensitive).
	const exists = tags.some(
		(t) => t.name.toLowerCase() === trimmed.toLowerCase(),
	);
	const canCreate = trimmed.length > 0 && !exists;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
				>
					<TagIcon className="size-3" />
					Tag
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-60 p-0" align="start">
				<Command
					// Let our own substring logic drive what's shown (we add a Create row).
					filter={(value, search) =>
						value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
					}
				>
					<CommandInput
						placeholder="Search or create…"
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{!canCreate && <CommandEmpty>No tags found.</CommandEmpty>}
						<CommandGroup>
							{tags.map((tag) => {
								const on = attached.has(tag.id);
								return (
									<CommandItem
										key={tag.id}
										value={tag.name}
										onSelect={() => onToggle(tag)}
										className="gap-2"
									>
										<span
											className="size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: tag.color ?? "#6b7280" }}
										/>
										<span className="flex-1 truncate">{tag.name}</span>
										<Check
											className={cn(
												"size-3.5 shrink-0",
												on ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
								);
							})}
							{canCreate && (
								<CommandItem
									value={`__create__${trimmed}`}
									onSelect={() => {
										onCreate(trimmed);
										setQuery("");
									}}
									disabled={creating}
									className="gap-2 text-muted-foreground"
								>
									<Plus className="size-3.5 shrink-0" />
									<span className="truncate">
										Create “<span className="text-foreground">{trimmed}</span>”
									</span>
								</CommandItem>
							)}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
