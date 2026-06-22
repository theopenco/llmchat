"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ds";
import { PageContainer } from "@/components/page-container";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

import type { Source } from "../types";
import { SourcesPanel } from "./SourcesPanel";
import { useSourceMutations } from "./useSourceMutations";

interface ProjectName {
	id: string;
	name: string;
}

export default function SourcesPage() {
	const { id } = useParams<{ id: string }>();
	const { workspaceId } = useWorkspace();

	const sourcesQ = useQuery({
		queryKey: ["sources", id],
		enabled: !!id && !!workspaceId,
		queryFn: () =>
			api<{ sources: Source[] }>(`/api/projects/${id}/sources`, {
				workspaceId: workspaceId!,
			}),
	});
	const sources = sourcesQ.data?.sources ?? [];

	// Project name from the cached projects list (already fetched by the shell);
	// header falls back to a neutral label if it isn't loaded.
	const projectsQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ProjectName[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});
	const projectName = projectsQ.data?.projects.find((p) => p.id === id)?.name;

	const { addSource, addText, addQa, refreshSource, deleteSource } =
		useSourceMutations(id, workspaceId);

	return (
		<PageContainer>
			<header className="mb-6 flex items-start justify-between gap-4">
				<div>
					<div className="flex items-center gap-2.5">
						<h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ck-text">
							Sources
						</h1>
						{!sourcesQ.isLoading && sources.length > 0 && (
							<span className="rounded-full bg-ck-chip px-2 py-0.5 font-mono text-xs font-semibold text-ck-muted">
								{sources.length}
							</span>
						)}
					</div>
					<p className="mt-1 text-sm text-ck-muted">
						Content {projectName ? `${projectName}'s` : "this project's"}{" "}
						support agent retrieves answers from.
					</p>
				</div>
				{/* Jumps to the always-visible add panel — real affordance, no fake. */}
				<Button
					className="shrink-0"
					onClick={() =>
						document
							.getElementById("sources-add")
							?.scrollIntoView({ behavior: "smooth", block: "start" })
					}
				>
					<Plus className="size-4" />
					Add source
				</Button>
			</header>

			<SourcesPanel
				sources={sources}
				isLoading={sourcesQ.isLoading}
				onAddUrl={(url) => addSource.mutate(url)}
				onAddText={(input) => addText.mutate(input)}
				onAddQa={(input) => addQa.mutate(input)}
				onRefresh={(sid) => refreshSource.mutate(sid)}
				onDelete={(sid) => deleteSource.mutate(sid)}
				addUrlPending={addSource.isPending}
				addTextPending={addText.isPending}
				addQaPending={addQa.isPending}
				refreshingId={refreshSource.isPending ? refreshSource.variables : null}
			/>
		</PageContainer>
	);
}
