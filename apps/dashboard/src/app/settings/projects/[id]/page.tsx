"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

import { BotBasicsCard } from "./BotBasicsCard";
import { ChatPreviewCard } from "./ChatPreviewCard";
import { ConfigurationSummaryCard } from "./ConfigurationSummaryCard";
import { DangerZoneCard } from "./DangerZoneCard";
import { EmbedCard } from "./EmbedCard";
import { InstructionsCard } from "./InstructionsCard";
import { DEFAULT_MODEL, useGatewayModels } from "./model-data";
import { ModelCard } from "./ModelCard";
import { ProjectHeader } from "./ProjectHeader";
import { SetupProgressCard } from "./SetupProgressCard";
import { SourcesCard } from "./SourcesCard";
import { useProjectMutations } from "./useProjectMutations";
import type { Project, ProjectDraft, Source } from "./types";

const EDITABLE_KEYS: (keyof ProjectDraft)[] = [
	"name",
	"welcomeMessage",
	"brandColor",
	"model",
	"systemPrompt",
];

function handlePreview() {
	document
		.getElementById("chat-preview")
		?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function toDraft(p: Project): ProjectDraft {
	return {
		name: p.name,
		welcomeMessage: p.welcomeMessage,
		brandColor: p.brandColor,
		model: p.model,
		systemPrompt: p.systemPrompt,
	};
}

export default function ProjectSettingsPage() {
	const { id } = useParams<{ id: string }>();
	const { workspaceId } = useWorkspace();

	const [draft, setDraft] = useState<ProjectDraft | null>(null);
	const [showDelete, setShowDelete] = useState(false);

	const projectQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
		select: (d) => d.projects.find((p) => p.id === id),
	});
	const project = projectQ.data;

	const sourcesQ = useQuery({
		queryKey: ["sources", id],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ sources: Source[] }>(`/api/projects/${id}/sources`, {
				workspaceId: workspaceId!,
			}),
	});
	const sources = sourcesQ.data?.sources ?? [];

	const modelsQ = useGatewayModels();

	// Seed the draft once per project id; preserves edits across background refetches.
	useEffect(() => {
		if (project) setDraft(toDraft(project));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [project?.id]);

	const { save, remove, addSource, refreshSource, deleteSource } =
		useProjectMutations(id, workspaceId);

	if (!project || !draft) {
		return (
			<div className="min-h-svh bg-muted">
				<div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8 lg:flex-row">
					<div className="flex flex-1 flex-col gap-6">
						<Skeleton className="h-20 w-80" />
						<Skeleton className="h-48 w-full rounded-2xl" />
						<Skeleton className="h-40 w-full rounded-2xl" />
					</div>
					<Skeleton className="h-96 w-full rounded-2xl lg:w-[360px]" />
				</div>
			</div>
		);
	}

	function set<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
		setDraft((d) => (d ? { ...d, [key]: value } : d));
	}

	const dirtyKeys = EDITABLE_KEYS.filter((k) => draft[k] !== project[k]);
	const dirty = dirtyKeys.length > 0;

	function handleSave() {
		if (!dirty || !draft) return;
		const payload: Partial<Project> = {};
		for (const k of dirtyKeys) {
			(payload as Record<string, unknown>)[k] = draft[k];
		}
		// Editing the single Instructions field makes the project's systemPrompt
		// authoritative, so clear any active library prompt that would override it.
		if (dirtyKeys.includes("systemPrompt")) {
			payload.activeSystemPromptId = null;
		}
		save.mutate(payload);
	}

	const selectedId = draft.model || DEFAULT_MODEL;
	const modelName =
		modelsQ.data?.find((m) => m.id === selectedId)?.name ?? selectedId;

	return (
		<div className="min-h-svh bg-muted">
			<div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8">
				<ProjectHeader
					name={draft.name}
					modelName={modelName}
					sourceCount={sources.length}
					dirty={dirty}
					saving={save.isPending}
					onSave={handleSave}
					onPreview={handlePreview}
				/>

				<div className="flex flex-col gap-6 lg:flex-row">
					<main className="flex min-w-0 flex-1 flex-col gap-6">
						<BotBasicsCard draft={draft} set={set} />
						<ModelCard
							value={draft.model}
							onChange={(m) => {
								set("model", m);
								track(ANALYTICS_EVENTS.modelChanged, { model: m });
							}}
						/>
						<InstructionsCard
							value={draft.systemPrompt}
							onChange={(v) => set("systemPrompt", v)}
						/>
						<SourcesCard
							sources={sources}
							isLoading={sourcesQ.isLoading}
							onAdd={(url) => addSource.mutate(url)}
							onRefresh={(sid) => refreshSource.mutate(sid)}
							onDelete={(sid) => deleteSource.mutate(sid)}
							addPending={addSource.isPending}
							refreshingId={
								refreshSource.isPending
									? (refreshSource.variables as string)
									: null
							}
						/>
						<EmbedCard
							publicKey={project.publicKey}
							brandColor={draft.brandColor}
						/>
					</main>

					<aside className="shrink-0 lg:w-[360px]">
						<div className="flex flex-col gap-6 lg:sticky lg:top-6">
							<SetupProgressCard
								hasProject
								hasModel={!!draft.model}
								hasInstructions={draft.systemPrompt.trim().length > 0}
								hasSources={sources.length > 0}
								hasEmbedCode={!!project.publicKey}
							/>
							<ChatPreviewCard
								name={draft.name}
								welcomeMessage={draft.welcomeMessage}
								brandColor={draft.brandColor}
							/>
							<ConfigurationSummaryCard
								modelName={modelName}
								brandColor={draft.brandColor}
								welcomeMessage={draft.welcomeMessage}
								sourceCount={sources.length}
								embedPath={`/embed/${project.publicKey}`}
							/>
							<DangerZoneCard onDelete={() => setShowDelete(true)} />
						</div>
					</aside>
				</div>
			</div>

			<AlertDialog open={showDelete} onOpenChange={setShowDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete &ldquo;{project.name}&rdquo;?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently remove the project and all its
							conversations.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								remove.mutate();
							}}
							disabled={remove.isPending}
						>
							{remove.isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
