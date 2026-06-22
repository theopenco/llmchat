"use client";

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

export interface DeleteProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	pending: boolean;
}

/**
 * Project-delete confirm. A plain submit Button — NOT AlertDialogAction (which
 * auto-closes on click and, under React 18, can fire before the handler) — and
 * the parent's mutation is non-optimistic: the dialog stays open showing
 * "Deleting…" until the server confirms, so a failed delete surfaces instead of
 * reading as success. Consistent with the workspace + conversation deletes.
 */
export function DeleteProjectDialog({
	open,
	onOpenChange,
	onConfirm,
	pending,
}: DeleteProjectDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete project?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. All conversations and data for this
						project will be permanently removed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
					<Button
						variant="primary"
						className="bg-ck-warn hover:bg-ck-warn/90"
						disabled={pending}
						onClick={onConfirm}
					>
						{pending ? "Deleting…" : "Delete"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
