"use client";

import { useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The user's email — the confirmation must match it (case-insensitive). */
	email: string;
	/** When true, the user has a password and must re-enter it to confirm. */
	requirePassword: boolean;
	pending: boolean;
	onConfirm: (input: { confirmEmail: string; password?: string }) => void;
}

/**
 * Final confirmation for the irreversible account deletion: type-the-email +,
 * when the user has a password, re-enter it. Both are reset whenever the dialog
 * closes so a prior attempt can't pre-arm the destructive button. The server is
 * authoritative — it re-confirms the email, re-verifies the password, and
 * re-checks the subscription/co-owner gates — this is just the front-line gate.
 */
export function DeleteAccountDialog({
	open,
	onOpenChange,
	email,
	requirePassword,
	pending,
	onConfirm,
}: DeleteAccountDialogProps) {
	const [confirmEmail, setConfirmEmail] = useState("");
	const [password, setPassword] = useState("");

	const emailMatches =
		confirmEmail.trim().toLowerCase() === email.toLowerCase();
	const passwordOk = !requirePassword || password.length > 0;
	const armed = emailMatches && passwordOk && !pending;

	function handleOpenChange(next: boolean) {
		if (!next) {
			setConfirmEmail("");
			setPassword("");
		}
		onOpenChange(next);
	}

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete your account?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently deletes your account and every workspace you solely
						own — all projects, conversations, messages, sources, tags, and
						usage history. This cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (armed) {
							onConfirm({
								confirmEmail: confirmEmail.trim(),
								password: requirePassword ? password : undefined,
							});
						}
					}}
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="confirm-email">
							Type{" "}
							<span className="font-semibold text-foreground">{email}</span> to
							confirm
						</Label>
						<Input
							id="confirm-email"
							value={confirmEmail}
							onChange={(e) => setConfirmEmail(e.target.value)}
							autoComplete="off"
							aria-label="Confirm email"
						/>
					</div>

					{requirePassword && (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="confirm-password">Your password</Label>
							<Input
								id="confirm-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								aria-label="Password"
							/>
						</div>
					)}

					<AlertDialogFooter>
						<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="submit"
							disabled={!armed}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{pending ? "Deleting…" : "Delete account"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	);
}
