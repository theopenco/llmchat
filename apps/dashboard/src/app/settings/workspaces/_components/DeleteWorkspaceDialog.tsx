"use client";

import { useState } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Why deletion is pre-blocked, surfaced before the user even types the name. */
export type DeleteBlock = "active_subscription" | "last_workspace" | null;

export interface DeleteWorkspaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The workspace name — the confirmation must match it exactly. */
	workspaceName: string;
	pending: boolean;
	/** A pre-known blocker (active sub / last workspace) → disables confirm and
	 * shows guidance. The server re-checks regardless. */
	block?: DeleteBlock;
	/** A failure message to surface inline (so deletion never fails silently). */
	error?: string | null;
	/** Switch into this workspace and open its Billing page (to cancel the sub). */
	onManageBilling?: () => void;
	onConfirm: () => void;
}

/**
 * GitHub-repo-delete-style confirmation: type the workspace NAME to arm the
 * irreversible delete. Pre-known blockers (an active subscription, or this being
 * the user's last workspace) disable the confirm and explain the fix. The
 * confirm is a plain <Button>, NOT AlertDialogAction — AlertDialogAction
 * auto-closes the dialog on click and (under React 18) unmounts the form before
 * the native submit fires, so the request never goes out (the dead-button bug).
 */
export function DeleteWorkspaceDialog({
	open,
	onOpenChange,
	workspaceName,
	pending,
	block = null,
	error,
	onManageBilling,
	onConfirm,
}: DeleteWorkspaceDialogProps) {
	const [confirmName, setConfirmName] = useState("");

	const nameMatches = confirmName === workspaceName;
	const armed = nameMatches && !block && !pending;

	function handleOpenChange(next: boolean) {
		if (!next) setConfirmName("");
		onOpenChange(next);
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently deletes{" "}
						<span className="font-semibold text-foreground">
							{workspaceName}
						</span>{" "}
						and everything in it — all projects, conversations, messages,
						sources, tags, and usage history. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				{block === "active_subscription" ? (
					<div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
						<span>
							This workspace has an active subscription. Cancel it in Billing
							before deleting the workspace.
						</span>
						{onManageBilling && (
							<Button variant="outline" size="sm" onClick={onManageBilling}>
								Go to Billing
							</Button>
						)}
					</div>
				) : block === "last_workspace" ? (
					<p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
						This is your only workspace. Create another first, or delete your
						account instead.
					</p>
				) : (
					<form
						className="flex flex-col gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							if (armed) onConfirm();
						}}
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="confirm-workspace-name">
								Type{" "}
								<span className="font-semibold text-foreground">
									{workspaceName}
								</span>{" "}
								to confirm
							</Label>
							<Input
								id="confirm-workspace-name"
								value={confirmName}
								onChange={(e) => setConfirmName(e.target.value)}
								autoComplete="off"
								aria-label="Confirm workspace name"
							/>
						</div>

						{/* Surface any failure inline so deletion never fails silently. */}
						{error && (
							<p role="alert" className="text-sm text-destructive">
								{error}
							</p>
						)}

						<AlertDialogFooter>
							<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
							{/*
							 * A plain submit Button — NOT AlertDialogAction. AlertDialogAction
							 * auto-closes the dialog on click; under React 18 that flush
							 * unmounts this <form> before the browser dispatches the native
							 * `submit`, so onConfirm never ran and no DELETE was issued. This
							 * button submits without closing — the dialog stays mounted
							 * through the async delete and closes only on success.
							 */}
							<Button type="submit" variant="destructive" disabled={!armed}>
								{pending ? "Deleting…" : "Delete workspace"}
							</Button>
						</AlertDialogFooter>
					</form>
				)}

				{/* When blocked, the form (and its footer) is hidden — give a way out. */}
				{block && (
					<AlertDialogFooter>
						<AlertDialogCancel type="button">Close</AlertDialogCancel>
					</AlertDialogFooter>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
}
