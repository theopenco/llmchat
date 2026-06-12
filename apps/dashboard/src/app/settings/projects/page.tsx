"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FolderPlus, Pin, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

import { CreateProjectDialog } from "./_components/CreateProjectDialog";
import { DeleteProjectDialog } from "./_components/DeleteProjectDialog";
import { filterAndSortProjects, partitionPinned } from "./_components/filter";
import { ProjectCard } from "./_components/ProjectCard";
import { ProjectFilters } from "./_components/ProjectFilters";
import { ProjectsGridSkeleton } from "./_components/ProjectsGridSkeleton";
import type { ProjectListItem, ProjectSortMode } from "./_components/types";

export default function ProjectsPage() {
	const { workspaceId } = useWorkspace();
	const qc = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<ProjectSortMode>("recent");
	const [favOnly, setFavOnly] = useState(false);

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ProjectListItem[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	const create = useMutation({
		mutationFn: (input: { name: string }) =>
			api<{ project: ProjectListItem }>("/api/projects", {
				method: "POST",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			setShowCreate(false);
			setName("");
			track(ANALYTICS_EVENTS.projectCreated, {
				project_id: res.project.id,
				source: "projects_page",
			});
			toast.success("Project created");
		},
		onError: (e) =>
			toast.error("Failed to create project", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const remove = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: (_res, id) => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			setDeleteId(null);
			track(ANALYTICS_EVENTS.projectDeleted, { project_id: id });
			toast.success("Project deleted");
		},
		onError: (e) =>
			toast.error("Failed to delete project", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const toggle = useMutation({
		mutationFn: (input: { id: string; favorite?: boolean; pinned?: boolean }) =>
			api<{ project: ProjectListItem }>(`/api/projects/${input.id}`, {
				method: "PATCH",
				body:
					input.favorite !== undefined
						? { favorite: input.favorite }
						: { pinned: input.pinned },
				workspaceId: workspaceId!,
			}),
		onMutate: async (input) => {
			await qc.cancelQueries({ queryKey: ["projects", workspaceId] });
			const prev = qc.getQueryData<{ projects: ProjectListItem[] }>([
				"projects",
				workspaceId,
			]);
			qc.setQueryData<{ projects: ProjectListItem[] }>(
				["projects", workspaceId],
				(old) =>
					old && {
						projects: old.projects.map((p) =>
							p.id === input.id ? { ...p, ...input } : p,
						),
					},
			);
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) qc.setQueryData(["projects", workspaceId], ctx.prev);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
		},
	});

	const list = projects.data?.projects ?? [];
	const filtered = useMemo(
		() => filterAndSortProjects(list, { search, favOnly, sort }),
		[list, search, favOnly, sort],
	);
	const { pinned, rest } = partitionPinned(filtered);

	return (
		<div className="mx-auto max-w-5xl px-6 py-10">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Projects</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Manage your chat projects and their configurations.
					</p>
				</div>
				<Button onClick={() => setShowCreate(true)}>
					<Plus />
					New Project
				</Button>
			</div>

			{(list.length > 0 || search || favOnly) && (
				<ProjectFilters
					search={search}
					onSearchChange={setSearch}
					favOnly={favOnly}
					onFavOnlyChange={setFavOnly}
					sort={sort}
					onSortChange={setSort}
				/>
			)}

			<CreateProjectDialog
				open={showCreate}
				onOpenChange={(open) => {
					setShowCreate(open);
					if (!open) setName("");
				}}
				name={name}
				onNameChange={setName}
				onSubmit={() => create.mutate({ name: name.trim() })}
				pending={create.isPending}
			/>

			<DeleteProjectDialog
				open={deleteId !== null}
				onOpenChange={(open) => !open && setDeleteId(null)}
				onConfirm={() => deleteId && remove.mutate(deleteId)}
				pending={remove.isPending}
			/>

			{projects.isLoading ? (
				<ProjectsGridSkeleton />
			) : list.length === 0 ? (
				<Empty className="py-20">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FolderOpen />
						</EmptyMedia>
						<EmptyTitle>No projects yet</EmptyTitle>
						<EmptyDescription>
							Create your first project to get started.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={() => setShowCreate(true)}>
							<FolderPlus />
							Create Project
						</Button>
					</EmptyContent>
				</Empty>
			) : filtered.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No matching projects</EmptyTitle>
						<EmptyDescription>
							Try a different search or clear your filters.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							variant="outline"
							onClick={() => {
								setSearch("");
								setFavOnly(false);
							}}
						>
							Clear filters
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<div className="flex flex-col gap-8">
					{pinned.length > 0 && (
						<section>
							<div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								<Pin className="size-3" />
								Pinned
							</div>
							<ProjectGrid
								projects={pinned}
								onToggleFavorite={(id, favorite) =>
									toggle.mutate({ id, favorite })
								}
								onTogglePin={(id, pinned) => toggle.mutate({ id, pinned })}
								onDelete={setDeleteId}
							/>
						</section>
					)}
					{rest.length > 0 && (
						<section>
							{pinned.length > 0 && (
								<div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									All projects
								</div>
							)}
							<ProjectGrid
								projects={rest}
								onToggleFavorite={(id, favorite) =>
									toggle.mutate({ id, favorite })
								}
								onTogglePin={(id, pinned) => toggle.mutate({ id, pinned })}
								onDelete={setDeleteId}
							/>
						</section>
					)}
				</div>
			)}
		</div>
	);
}

function ProjectGrid({
	projects,
	onToggleFavorite,
	onTogglePin,
	onDelete,
}: {
	projects: ProjectListItem[];
	onToggleFavorite: (id: string, next: boolean) => void;
	onTogglePin: (id: string, next: boolean) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{projects.map((project) => (
				<ProjectCard
					key={project.id}
					project={project}
					onToggleFavorite={onToggleFavorite}
					onTogglePin={onTogglePin}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}
