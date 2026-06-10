"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
	FolderPlus,
	Plus,
	Search,
	Star,
	Pin,
	Trash2,
	X,
	FolderOpen,
	Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectGroup,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface Project {
	id: string;
	name: string;
	publicKey: string;
	model: string;
	brandColor: string;
	favorite: boolean;
	pinned: boolean;
	createdAt: string;
}

type SortMode = "recent" | "name";

export default function ProjectsPage() {
	const { workspaceId } = useWorkspace();
	const qc = useQueryClient();
	const [showCreate, setShowCreate] = useState(false);
	const [name, setName] = useState("");
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortMode>("recent");
	const [favOnly, setFavOnly] = useState(false);

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	const create = useMutation({
		mutationFn: (input: { name: string }) =>
			api<{ project: Project }>("/api/projects", {
				method: "POST",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			setShowCreate(false);
			setName("");
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
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			setDeleteId(null);
			toast.success("Project deleted");
		},
		onError: (e) =>
			toast.error("Failed to delete project", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const toggle = useMutation({
		mutationFn: (input: { id: string; favorite?: boolean; pinned?: boolean }) =>
			api<{ project: Project }>(`/api/projects/${input.id}`, {
				method: "PATCH",
				body:
					input.favorite !== undefined
						? { favorite: input.favorite }
						: { pinned: input.pinned },
				workspaceId: workspaceId!,
			}),
		onMutate: async (input) => {
			await qc.cancelQueries({ queryKey: ["projects", workspaceId] });
			const prev = qc.getQueryData<{ projects: Project[] }>([
				"projects",
				workspaceId,
			]);
			qc.setQueryData<{ projects: Project[] }>(
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

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		let rows = list.filter((p) => {
			if (favOnly && !p.favorite) return false;
			if (!q) return true;
			return (
				p.name.toLowerCase().includes(q) ||
				p.model.toLowerCase().includes(q) ||
				p.publicKey.toLowerCase().includes(q)
			);
		});
		rows = [...rows].sort((a, b) => {
			if (sort === "name") return a.name.localeCompare(b.name);
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
		return rows;
	}, [list, search, favOnly, sort]);

	const pinned = filtered.filter((p) => p.pinned);
	const rest = filtered.filter((p) => !p.pinned);

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
				<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search projects, model, key…"
							className="pl-9"
						/>
						{search && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => setSearch("")}
								className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
								title="Clear"
							>
								<X />
							</Button>
						)}
					</div>
					<Toggle
						variant="outline"
						size="lg"
						pressed={favOnly}
						onPressedChange={setFavOnly}
						title="Show favorites only"
						className={cn(
							favOnly && "text-warning border-warning/30 bg-warning/10",
						)}
					>
						<Star className={cn(favOnly && "fill-warning text-warning")} />
						Favorites
					</Toggle>
					<Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
						<SelectTrigger className="w-auto min-w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectItem value="recent">Newest</SelectItem>
								<SelectItem value="name">Name (A–Z)</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			)}

			<Dialog
				open={showCreate}
				onOpenChange={(open) => {
					if (!open) {
						setShowCreate(false);
						setName("");
					} else setShowCreate(true);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create a new project</DialogTitle>
						<DialogDescription>
							Give your project a name to get started.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (!name.trim()) return;
							create.mutate({ name: name.trim() });
						}}
						className="flex flex-col gap-4"
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="new-project-name">Project name</Label>
							<Input
								id="new-project-name"
								autoFocus
								required
								placeholder="e.g. Support Bot, Sales Assistant"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setShowCreate(false);
									setName("");
								}}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={create.isPending || !name.trim()}>
								{create.isPending ? "Creating…" : "Create Project"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={deleteId !== null}
				onOpenChange={(open) => !open && setDeleteId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete project?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. All conversations and data for this
							project will be permanently removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								if (deleteId) remove.mutate(deleteId);
							}}
							disabled={remove.isPending}
						>
							{remove.isPending ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{projects.isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-44 w-full rounded-2xl" />
					))}
				</div>
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
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{pinned.map((p) => renderCard(p))}
							</div>
						</section>
					)}
					{rest.length > 0 && (
						<section>
							{pinned.length > 0 && (
								<div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									All projects
								</div>
							)}
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{rest.map((p) => renderCard(p))}
							</div>
						</section>
					)}
				</div>
			)}
		</div>
	);

	function renderCard(p: Project) {
		return (
			<Card
				key={p.id}
				className="group relative flex flex-col p-5 transition-all hover:border-foreground/15 hover:shadow-md"
			>
				{/* Top row: color + favorite/pin toggles */}
				<div className="mb-4 flex items-start justify-between">
					<div
						className="h-2 w-10 rounded-full"
						style={{ backgroundColor: p.brandColor || "#000" }}
					/>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className={cn(
								"size-8",
								p.favorite
									? "text-warning hover:text-warning"
									: "text-muted-foreground/50",
							)}
							onClick={() => toggle.mutate({ id: p.id, favorite: !p.favorite })}
							title={p.favorite ? "Unfavorite" : "Favorite"}
						>
							<Star className={cn(p.favorite && "fill-warning")} />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className={cn(
								"size-8",
								p.pinned ? "text-foreground" : "text-muted-foreground/50",
							)}
							onClick={() => toggle.mutate({ id: p.id, pinned: !p.pinned })}
							title={p.pinned ? "Unpin" : "Pin"}
						>
							<Pin className={cn(p.pinned && "fill-current")} />
						</Button>
					</div>
				</div>
				<h3 className="text-base font-semibold">{p.name}</h3>
				<p className="mt-1 font-mono text-xs text-muted-foreground">
					{p.publicKey.slice(0, 20)}…
				</p>
				<div className="mt-3 flex items-center gap-2">
					<Badge variant="secondary">{p.model}</Badge>
				</div>
				<div className="mt-auto flex items-center gap-2 pt-5">
					<Button asChild variant="outline" className="flex-1">
						<Link href={`/settings/projects/${p.id}`}>
							<Settings />
							Configure
						</Link>
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => setDeleteId(p.id)}
						className="border-destructive/20 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						title="Delete project"
					>
						<Trash2 />
					</Button>
				</div>
			</Card>
		);
	}
}
