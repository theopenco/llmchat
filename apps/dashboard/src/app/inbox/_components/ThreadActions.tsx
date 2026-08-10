"use client";

import { Check, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ds";

/**
 * Thread-header action row, matching the target design. LIVE: Resolve/Reopen
 * (toggles archived — our only "closed" state, so there's no separate
 * Archive), Delete (non-optimistic, confirm dialog), and Assign (#96 — the
 * AssigneePicker, passed in as a slot so this row stays presentational).
 */
export function ThreadActions({
	resolved,
	onResolve,
	onDelete,
	resolving,
	deleting,
	assignControl,
}: {
	resolved: boolean;
	onResolve: () => void;
	onDelete: () => void;
	resolving: boolean;
	deleting: boolean;
	/** The AssigneePicker for the open conversation (#96). */
	assignControl?: ReactNode;
}) {
	const [confirmOpen, setConfirmOpen] = useState(false);

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={resolving}
				onClick={onResolve}
			>
				{resolved ? (
					<>
						<RotateCcw className="size-4" />
						<span className="hidden sm:inline">Reopen</span>
					</>
				) : (
					<>
						<Check className="size-4" />
						<span className="hidden sm:inline">Resolve</span>
					</>
				)}
			</Button>

			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="text-ck-warn hover:bg-ck-warn/10 hover:text-ck-warn"
				onClick={() => setConfirmOpen(true)}
			>
				<Trash2 className="size-4" />
				<span className="hidden sm:inline">Delete</span>
			</Button>

			{assignControl}

			{/*
			 * Controlled AlertDialog + a plain submit Button — NOT AlertDialogAction,
			 * which auto-closes on click and unmounts before the handler fires. Delete
			 * stays non-optimistic: the dialog shows "Deleting…" until the server
			 * confirms, so a failed delete surfaces instead of reading as success.
			 */}
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete conversation?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the conversation and all its messages.
							This can&apos;t be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
						<Button
							variant="primary"
							className="bg-ck-warn hover:bg-ck-warn/90"
							disabled={deleting}
							onClick={onDelete}
						>
							{deleting ? "Deleting…" : "Delete"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
