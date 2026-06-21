"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeApiError } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY } from "@/lib/workspace-utils";
import { createWorkspace } from "@/lib/workspaces";

const NAME_MAX = 100;

export interface CreateWorkspaceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Create-a-workspace flow, shared by the sidebar switcher and the
 * /settings/workspaces page. On success it switches into the new workspace and
 * sends the user to onboarding — the workspace is plan=none, so they land on the
 * "choose a plan to launch" paywall (escapable via #62), which is the right next
 * step rather than dropping them into a half-configured workspace.
 */
export function CreateWorkspaceDialog({
	open,
	onOpenChange,
}: CreateWorkspaceDialogProps) {
	const qc = useQueryClient();
	const router = useRouter();
	const { setWorkspaceId } = useWorkspace();
	const [name, setName] = useState("");
	const trimmed = name.trim();

	const create = useMutation({
		mutationFn: () => createWorkspace(trimmed),
		onSuccess: async ({ workspace }) => {
			// Make the new workspace visible everywhere, then switch into it.
			await qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
			setWorkspaceId(workspace.id);
			onOpenChange(false);
			setName("");
			toast.success(`Workspace "${workspace.name}" created`);
			router.push("/onboarding");
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Couldn't create the workspace")),
	});

	function handleOpenChange(next: boolean) {
		if (!next) setName("");
		onOpenChange(next);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a workspace</DialogTitle>
					<DialogDescription>
						A workspace is a separate billing account with its own projects and
						team. You&apos;ll choose a plan after creating it.
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (trimmed && !create.isPending) create.mutate();
					}}
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="workspace-name">Name</Label>
						<Input
							id="workspace-name"
							value={name}
							maxLength={NAME_MAX}
							onChange={(e) => setName(e.target.value)}
							placeholder="Acme Inc."
							autoComplete="off"
							autoFocus
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!trimmed || create.isPending}>
							{create.isPending ? "Creating…" : "Create workspace"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
