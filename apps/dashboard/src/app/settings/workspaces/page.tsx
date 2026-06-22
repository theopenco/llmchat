"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY, type WorkspaceSummary } from "@/lib/workspace-utils";
import { deleteWorkspace, deleteWorkspaceErrorMessage } from "@/lib/workspaces";

import { CreateWorkspaceDialog } from "./_components/CreateWorkspaceDialog";
import {
	DeleteWorkspaceDialog,
	type DeleteBlock,
} from "./_components/DeleteWorkspaceDialog";

function roleLabel(role: WorkspaceSummary["role"]) {
	return role[0].toUpperCase() + role.slice(1);
}

export default function WorkspacesSettingsPage() {
	const qc = useQueryClient();
	const router = useRouter();
	const { workspaces, workspaceId, setWorkspaceId, isLoading } = useWorkspace();

	const [createOpen, setCreateOpen] = useState(false);
	const [deleting, setDeleting] = useState<WorkspaceSummary | null>(null);

	// Workspace delete is deliberately NOT optimistic. This is a modal,
	// server-confirmed destructive op: the confirm dialog stays open showing
	// "Deleting…" until the server acknowledges, so a failed delete surfaces
	// instead of the user thinking it worked. Removing the row from the
	// WORKSPACES_KEY cache in onMutate (the optimistic pattern) would feed back
	// through useWorkspace and shrink `workspaces` mid-flight — flipping the
	// `block` below to "last_workspace" when deleting one of two, which replaces
	// the in-progress confirm form with a misleading "this is your only
	// workspace" blocker. Optimism fits non-modal toggles (pin/star/archive);
	// here the modal occludes the list, so there's no instant-feedback to gain.
	// The list reconciles via invalidate AFTER the server confirms.
	const remove = useMutation({
		mutationFn: (id: string) => deleteWorkspace(id),
		onSuccess: async (_data, id) => {
			setDeleting(null);
			toast.success("Workspace deleted");
			// If they deleted the workspace they were in, switch into another one they
			// belong to and drop now-stale per-workspace caches so nothing renders the
			// deleted context. /settings/workspaces is an onboarding escape route, so
			// staying here is safe even if the next workspace has no plan.
			if (id === workspaceId) {
				const next = workspaces.find((w) => w.id !== id);
				qc.removeQueries({ queryKey: ["projects"] });
				qc.removeQueries({ queryKey: ["billing-usage"] });
				if (next) setWorkspaceId(next.id);
			}
			await qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
		},
		onError: (e) => toast.error(deleteWorkspaceErrorMessage(e)),
	});

	// Pre-known blocker for the open delete dialog (the server re-checks live).
	const block: DeleteBlock = !deleting
		? null
		: workspaces.length <= 1
			? "last_workspace"
			: deleting.plan !== "none"
				? "active_subscription"
				: null;

	return (
		<div className="mx-auto w-full max-w-[800px] space-y-6 p-6">
			<header className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-display text-2xl font-semibold tracking-tight-display">
						Workspaces
					</h1>
					<p className="mt-0.5 text-sm text-muted-foreground">
						Each workspace is a separate billing account with its own projects
						and team.
					</p>
				</div>
				<Button onClick={() => setCreateOpen(true)} className="shrink-0">
					<Plus />
					Create workspace
				</Button>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Your workspaces</CardTitle>
					<CardDescription>
						Workspaces you belong to. Only an owner can delete a workspace.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-14 w-full" />
							<Skeleton className="h-14 w-full" />
						</div>
					) : (
						<ul className="divide-y divide-border rounded-lg border">
							{workspaces.map((w) => {
								const current = w.id === workspaceId;
								const owner = w.role === "owner";
								return (
									<li
										key={w.id}
										className="flex items-center justify-between gap-3 p-3"
									>
										<div className="flex min-w-0 flex-col gap-1">
											<div className="flex items-center gap-2">
												<span className="truncate font-medium">{w.name}</span>
												{current && (
													<Badge variant="secondary" className="gap-1">
														<Check className="size-3" />
														Current
													</Badge>
												)}
											</div>
											<span className="text-xs text-muted-foreground">
												{roleLabel(w.role)}
											</span>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{!current && (
												<Button
													variant="outline"
													size="sm"
													onClick={() => setWorkspaceId(w.id)}
												>
													Switch
												</Button>
											)}
											{owner && (
												<Button
													variant="ghost"
													size="sm"
													className="text-destructive hover:text-destructive"
													onClick={() => setDeleting(w)}
												>
													Delete
												</Button>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			<CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />

			{deleting && (
				<DeleteWorkspaceDialog
					open={!!deleting}
					onOpenChange={(o) => !o && setDeleting(null)}
					workspaceName={deleting.name}
					pending={remove.isPending}
					block={block}
					error={
						remove.isError ? deleteWorkspaceErrorMessage(remove.error) : null
					}
					onManageBilling={() => {
						setWorkspaceId(deleting.id);
						router.push("/settings/billing");
					}}
					onConfirm={() => remove.mutate(deleting.id)}
				/>
			)}
		</div>
	);
}
