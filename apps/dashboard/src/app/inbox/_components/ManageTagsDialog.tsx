"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { TAG_PALETTE } from "@llmchat/shared";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { pluralize } from "./format";
import type { Tag } from "./types";

const FALLBACK = "#6b7280";

/** Palette swatch grid for recoloring a tag. */
function RecolorPopover({
	tag,
	onRecolor,
	disabled,
}: {
	tag: Tag;
	onRecolor: (color: string) => void;
	disabled?: boolean;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					aria-label={`Recolor ${tag.name}`}
					className="size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 disabled:opacity-50 dark:ring-white/15"
					style={{ backgroundColor: tag.color ?? FALLBACK }}
				/>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-2" align="start">
				<div className="grid grid-cols-4 gap-1.5">
					{TAG_PALETTE.map((c) => {
						const active = (tag.color ?? "").toLowerCase() === c.toLowerCase();
						return (
							<button
								key={c}
								type="button"
								aria-label={`Set color ${c}`}
								onClick={() => {
									onRecolor(c);
									setOpen(false);
								}}
								className="grid size-6 place-items-center rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110 dark:ring-white/15"
								style={{ backgroundColor: c }}
							>
								{active && <Check className="size-3.5 text-white" />}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function ManageTagRow({
	tag,
	onRename,
	onRecolor,
	onDelete,
	busy,
}: {
	tag: Tag;
	onRename: (name: string) => void;
	onRecolor: (color: string) => void;
	onDelete: () => void;
	busy?: boolean;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(tag.name);
	const count = tag.count ?? 0;

	function commit() {
		const next = draft.trim();
		// Skip the call when nothing changed (the server treats a same-name rename
		// as a no-op anyway, but this avoids a needless request).
		if (next && next !== tag.name) onRename(next);
		setEditing(false);
	}

	return (
		<li className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
			<RecolorPopover tag={tag} onRecolor={onRecolor} disabled={busy} />

			{editing ? (
				<Input
					autoFocus
					value={draft}
					maxLength={40}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commit();
						if (e.key === "Escape") {
							setDraft(tag.name);
							setEditing(false);
						}
					}}
					onBlur={commit}
					aria-label={`Rename ${tag.name}`}
					className="h-7 flex-1 text-sm"
				/>
			) : (
				<>
					<span className="flex-1 truncate text-sm font-medium">
						{tag.name}
					</span>
					<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
						{pluralize(count, "conversation")}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-foreground"
						onClick={() => {
							setDraft(tag.name);
							setEditing(true);
						}}
						disabled={busy}
						aria-label={`Edit ${tag.name}`}
					>
						<Pencil className="size-3.5" />
					</Button>
				</>
			)}

			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"size-7 text-muted-foreground",
							"hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
						)}
						disabled={busy}
						aria-label={`Delete ${tag.name}`}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete “{tag.name}”?</AlertDialogTitle>
						<AlertDialogDescription>
							{count > 0
								? `It will be removed from ${pluralize(count, "conversation")}. This can't be undone.`
								: "This tag isn't on any conversations. This can't be undone."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={onDelete}
							className="bg-red-600 text-white hover:bg-red-600/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</li>
	);
}

export interface ManageTagsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tags: Tag[];
	onRename: (tag: Tag, name: string) => void;
	onRecolor: (tag: Tag, color: string) => void;
	onDelete: (tag: Tag) => void;
	/** The id of a tag with a mutation in flight (its row is disabled). */
	busyId?: string | null;
}

/**
 * Global tag management for the workspace: rename, recolor (palette), and delete
 * (with an impact-stating confirm). Admin/owner only — the caller renders this
 * behind a role gate, and the API enforces the same with requireRole("admin").
 */
export function ManageTagsDialog({
	open,
	onOpenChange,
	tags,
	onRename,
	onRecolor,
	onDelete,
	busyId,
}: ManageTagsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Manage tags</DialogTitle>
					<DialogDescription>
						Rename, recolor, or delete the tags used across this workspace.
					</DialogDescription>
				</DialogHeader>
				{tags.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						No tags yet. Create one from a conversation’s tag picker.
					</p>
				) : (
					<ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
						{tags.map((tag) => (
							<ManageTagRow
								key={tag.id}
								tag={tag}
								busy={busyId === tag.id}
								onRename={(name) => onRename(tag, name)}
								onRecolor={(color) => onRecolor(tag, color)}
								onDelete={() => onDelete(tag)}
							/>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}
