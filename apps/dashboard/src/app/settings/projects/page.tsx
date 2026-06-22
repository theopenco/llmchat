"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FolderPlus, Pin, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ds";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { api, describeApiError } from "@/lib/api";
import { mapById, useOptimisticMutation } from "@/lib/optimistic";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { RoleGate } from "@/components/role-gate";

import { CreateProjectDialog } from "./_components/CreateProjectDialog";
import { DeleteProjectDialog } from "./_components/DeleteProjectDialog";
import { filterAndSortProjects, partitionPinned } from "./_components/filter";
import { ProjectCard } from "./_components/ProjectCard";
import { ProjectFilters } from "./_components/ProjectFilters";
import { ProjectsGridSkeleton } from "./_components/ProjectsGridSkeleton";
import type { ProjectListItem, ProjectSortMode } from "./_components/types";

// Hoisted fallback so the filter memo isn't invalidated on every render while
// the query has no data yet.
const NO_PROJECTS: ProjectListItem[] = [];

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

	// Per-project 30-day response counts — a SEPARATE, lazy query (never folded
	// into the hot ["projects"] query). The grid renders from `projects` first;
	// cards show an honest "—" until this resolves, then the real count.
	const usage = useQuery({
		queryKey: ["projects-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ usage: Record<string, number> }>("/api/projects/usage", {
				workspaceId: workspaceId!,
			}),
	});
	const usageMap = usage.data?.usage;

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
			toast.error(describeApiError(e, "Failed to create project")),
	});

	// Delete is NON-optimistic + confirm: a permanent, irreversible delete must
	// not pull the card before the server acknowledges it (the bug fixed in
	// #68/#70). The confirm dialog stays open showing "Deleting…" until onSuccess,
	// which then closes it and reconciles the grid — so a failed delete surfaces,
	// never reads as success. (Favorite/pin toggles below stay optimistic: those
	// are reversible and non-destructive.)
	const remove = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: (_res, id) => {
			track(ANALYTICS_EVENTS.projectDeleted, { project_id: id });
			toast.success("Project deleted");
			setDeleteId(null);
			void qc.invalidateQueries({ queryKey: ["projects", workspaceId] });
			void qc.invalidateQueries({ queryKey: ["projects-usage", workspaceId] });
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Failed to delete project")),
	});

	// Optimistic pin/favorite toggle — the reference call site, now on the shared
	// helper instead of a hand-rolled onMutate/onError/onSettled.
	const toggle = useOptimisticMutation<
		{ id: string; favorite?: boolean; pinned?: boolean },
		{ project: ProjectListItem }
	>({
		queryKey: ["projects", workspaceId],
		apply: (prev, input) =>
			mapById<ProjectListItem>(prev, "projects", input.id, (p) => ({
				...p,
				...input,
			})),
		mutationFn: (input) =>
			api<{ project: ProjectListItem }>(`/api/projects/${input.id}`, {
				method: "PATCH",
				body:
					input.favorite !== undefined
						? { favorite: input.favorite }
						: { pinned: input.pinned },
				workspaceId: workspaceId!,
			}),
	});

	const list = projects.data?.projects ?? NO_PROJECTS;
	const filtered = useMemo(
		() => filterAndSortProjects(list, { search, favOnly, sort }),
		[list, search, favOnly, sort],
	);
	const { pinned, rest } = partitionPinned(filtered);

	return (
		<div className="mx-auto max-w-5xl px-6 py-10">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ck-text">
						Projects
					</h1>
					<p className="mt-1 text-sm text-ck-muted">
						Your support agents and their configuration.
					</p>
				</div>
				<RoleGate>
					<Button onClick={() => setShowCreate(true)}>
						<Plus />
						New Project
					</Button>
				</RoleGate>
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
				onConfirm={() => {
					// Non-optimistic: fire and let the dialog show pending; it closes on
					// success (see `remove`), never before the server confirms.
					if (deleteId) remove.mutate(deleteId);
				}}
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
						<RoleGate
							fallback={
								<p className="text-sm text-muted-foreground">
									Ask a workspace owner or admin to create one.
								</p>
							}
						>
							<Button onClick={() => setShowCreate(true)}>
								<FolderPlus />
								Create Project
							</Button>
						</RoleGate>
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
							<div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ck-faint">
								<Pin className="size-3" />
								Pinned
							</div>
							<ProjectGrid
								projects={pinned}
								usage={usageMap}
								onToggleFavorite={(id, favorite) =>
									toggle.mutate({ id, favorite })
								}
								onTogglePin={(id, nextPinned) =>
									toggle.mutate({ id, pinned: nextPinned })
								}
								onDelete={setDeleteId}
							/>
						</section>
					)}
					{rest.length > 0 && (
						<section>
							{pinned.length > 0 && (
								<div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ck-faint">
									All projects
								</div>
							)}
							<ProjectGrid
								projects={rest}
								usage={usageMap}
								onToggleFavorite={(id, favorite) =>
									toggle.mutate({ id, favorite })
								}
								onTogglePin={(id, nextPinned) =>
									toggle.mutate({ id, pinned: nextPinned })
								}
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
	usage,
	onToggleFavorite,
	onTogglePin,
	onDelete,
}: {
	projects: ProjectListItem[];
	/** 30-day response counts by project id; undefined entries render "—". */
	usage?: Record<string, number>;
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
					responses30d={usage?.[project.id]}
					onToggleFavorite={onToggleFavorite}
					onTogglePin={onTogglePin}
					onDelete={onDelete}
				/>
			))}
		</div>
	);
}
