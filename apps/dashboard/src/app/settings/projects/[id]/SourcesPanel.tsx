"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api } from "@/lib/api";
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
	Globe,
	Plus,
	RefreshCw,
	Trash2,
	Link as LinkIcon,
	Check,
	Search,
	ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface Source {
	id: string;
	projectId: string;
	url: string;
	title: string;
	content: string;
	active: boolean;
	lastFetchedAt: string | null;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

interface SourcesResponse {
	sources: Source[];
}

type FilterMode = "all" | "active" | "inactive" | "errors";

function formatHost(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function formatRelative(iso: string | null): string {
	if (!iso) return "never";
	const d = new Date(iso).getTime();
	const diff = Date.now() - d;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function SourcesPanel({
	projectId,
	workspaceId,
}: {
	projectId: string;
	workspaceId: string;
}) {
	const qc = useQueryClient();
	const [newUrl, setNewUrl] = useState("");
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<FilterMode>("all");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const sourcesQ = useQuery({
		queryKey: ["sources", projectId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<SourcesResponse>(`/api/projects/${projectId}/sources`, {
				workspaceId,
			}),
	});

	const sources = sourcesQ.data?.sources ?? [];
	const activeCount = sources.filter((s) => s.active).length;
	const errorCount = sources.filter((s) => s.lastError).length;

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return sources.filter((s) => {
			if (filter === "active" && !s.active) return false;
			if (filter === "inactive" && s.active) return false;
			if (filter === "errors" && !s.lastError) return false;
			if (!q) return true;
			return (
				s.url.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
			);
		});
	}, [sources, search, filter]);

	const createM = useMutation({
		mutationFn: (url: string) =>
			api<{ source: Source }>(`/api/projects/${projectId}/sources`, {
				method: "POST",
				body: { url },
				workspaceId,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", projectId] });
			setNewUrl("");
			toast.success("Source added");
		},
		onError: (e) =>
			toast.error("Failed to add source", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const toggleM = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			api(`/api/projects/${projectId}/sources/${id}`, {
				method: "PATCH",
				body: { active },
				workspaceId,
			}),
		onMutate: async ({ id, active }) => {
			await qc.cancelQueries({ queryKey: ["sources", projectId] });
			const prev = qc.getQueryData<SourcesResponse>(["sources", projectId]);
			if (prev) {
				qc.setQueryData<SourcesResponse>(["sources", projectId], {
					sources: prev.sources.map((s) =>
						s.id === id ? { ...s, active } : s,
					),
				});
			}
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) qc.setQueryData(["sources", projectId], ctx.prev);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["sources", projectId] });
		},
	});

	const refreshM = useMutation({
		mutationFn: (id: string) =>
			api<{ source: Source }>(
				`/api/projects/${projectId}/sources/${id}/refresh`,
				{ method: "POST", workspaceId },
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", projectId] });
			toast.success("Source refreshed");
		},
		onError: (e) =>
			toast.error("Refresh failed", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const deleteM = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${projectId}/sources/${id}`, {
				method: "DELETE",
				workspaceId,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", projectId] });
			toast.success("Source removed");
		},
		onError: (e) =>
			toast.error("Failed to remove source", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	function add() {
		const url = newUrl.trim();
		if (!url) return;
		try {
			new URL(url);
		} catch {
			toast.error("Enter a valid URL (include https://)");
			return;
		}
		createM.mutate(url);
	}

	return (
		<>
			<AlertDialog
				open={confirmDeleteId !== null}
				onOpenChange={(open) => !open && setConfirmDeleteId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove source?</AlertDialogTitle>
						<AlertDialogDescription>
							{(() => {
								const s = sources.find((x) => x.id === confirmDeleteId);
								return s
									? `"${s.title || s.url}" will be removed from the agent's sources.`
									: "";
							})()}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								if (confirmDeleteId) deleteM.mutate(confirmDeleteId);
								setConfirmDeleteId(null);
							}}
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Card className="overflow-hidden">
				<CardHeader className="flex-row items-center gap-3 space-y-0">
					<div className="flex size-9 items-center justify-center rounded-xl bg-info text-info-foreground">
						<Globe className="size-4" />
					</div>
					<div className="flex-1">
						<CardTitle>Sources</CardTitle>
						<CardDescription>
							URLs the agent reads from. Toggle which ones are active.
						</CardDescription>
					</div>
					<div className="hidden items-center gap-2 sm:flex">
						<Badge variant="success">{activeCount} active</Badge>
						<Badge variant="secondary">{sources.length} total</Badge>
						{errorCount > 0 && (
							<Badge variant="destructive">{errorCount} errors</Badge>
						)}
					</div>
				</CardHeader>
				<Separator />
				<CardContent className="flex flex-col gap-3 px-6 py-4">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={newUrl}
								onChange={(e) => setNewUrl(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										add();
									}
								}}
								placeholder="https://docs.example.com/getting-started"
								className="pl-9"
							/>
						</div>
						<Button
							type="button"
							onClick={add}
							disabled={createM.isPending || !newUrl.trim()}
						>
							<Plus />
							{createM.isPending ? "Fetching…" : "Add Source"}
						</Button>
					</div>
				</CardContent>
				<Separator />
				<CardContent className="flex items-center gap-2 px-6 py-3">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search sources…"
							className="h-9 pl-8 text-xs"
						/>
					</div>
					<ToggleGroup
						type="single"
						value={filter}
						onValueChange={(v) => v && setFilter(v as FilterMode)}
						size="sm"
					>
						<ToggleGroupItem value="all">
							All
							<span className="ml-1 text-muted-foreground">
								{sources.length}
							</span>
						</ToggleGroupItem>
						<ToggleGroupItem value="active">
							Active
							<span className="ml-1 text-muted-foreground">{activeCount}</span>
						</ToggleGroupItem>
						<ToggleGroupItem value="inactive">
							Off
							<span className="ml-1 text-muted-foreground">
								{sources.length - activeCount}
							</span>
						</ToggleGroupItem>
						<ToggleGroupItem value="errors">
							Errors
							<span className="ml-1 text-muted-foreground">{errorCount}</span>
						</ToggleGroupItem>
					</ToggleGroup>
				</CardContent>
				<Separator />
				<CardContent className="p-3">
					{sourcesQ.isLoading ? (
						<div className="flex flex-col gap-2 px-3">
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-16 w-full" />
							))}
						</div>
					) : sources.length === 0 ? (
						<Empty className="border-0 py-10">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Globe />
								</EmptyMedia>
								<EmptyTitle>No sources yet</EmptyTitle>
								<EmptyDescription>
									Paste a URL above. We&apos;ll fetch the page and let the agent
									reference it in answers.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : filtered.length === 0 ? (
						<p className="px-2 py-8 text-center text-xs text-muted-foreground">
							No matches
						</p>
					) : (
						<ul className="flex flex-col gap-1.5">
							{filtered.map((s) => {
								const isOpen = expandedId === s.id;
								const refreshing =
									refreshM.isPending && refreshM.variables === s.id;
								return (
									<li key={s.id}>
										<div
											className={cn(
												"group rounded-xl border transition-all",
												s.active
													? "bg-background hover:border-info/40 hover:shadow-sm"
													: "border-border/60 bg-muted/40 hover:bg-background",
											)}
										>
											<div className="flex items-start gap-3 px-3 py-2.5">
												<div className="mt-0.5">
													<Switch
														checked={s.active}
														onCheckedChange={(active) =>
															toggleM.mutate({ id: s.id, active })
														}
														aria-label={s.active ? "Deactivate" : "Activate"}
													/>
												</div>
												<button
													type="button"
													onClick={() => setExpandedId(isOpen ? null : s.id)}
													className="min-w-0 flex-1 text-left"
												>
													<div className="flex items-center gap-2">
														<span
															className={cn(
																"truncate text-sm font-medium",
																s.active
																	? "text-foreground"
																	: "text-muted-foreground",
															)}
														>
															{s.title || formatHost(s.url)}
														</span>
														{s.lastError && (
															<Badge variant="destructive">Error</Badge>
														)}
														{!s.lastError && s.active && (
															<Badge variant="success">
																<Check />
																In use
															</Badge>
														)}
													</div>
													<div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
														<LinkIcon className="size-3" />
														<span className="truncate">{s.url}</span>
													</div>
													<div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/70">
														<span>
															Fetched {formatRelative(s.lastFetchedAt)}
														</span>
														<span>•</span>
														<span>
															{s.content.length.toLocaleString()} chars
														</span>
														{s.content.length > 0 && (
															<>
																<span>•</span>
																<span>
																	~{Math.ceil(s.content.length / 4)} tok
																</span>
															</>
														)}
													</div>
												</button>
												<div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
													<Button
														asChild
														type="button"
														variant="ghost"
														size="icon"
														className="size-8 text-muted-foreground hover:text-foreground"
														title="Open URL"
													>
														<a
															href={s.url}
															target="_blank"
															rel="noreferrer noopener"
														>
															<ExternalLink />
														</a>
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="size-8 text-muted-foreground hover:text-info"
														onClick={() => refreshM.mutate(s.id)}
														disabled={refreshing}
														title="Re-fetch URL"
													>
														<RefreshCw
															className={cn(refreshing && "animate-spin")}
														/>
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
														onClick={() => setConfirmDeleteId(s.id)}
														title="Delete source"
													>
														<Trash2 />
													</Button>
												</div>
											</div>
											{isOpen && (
												<div className="border-t px-4 py-3">
													{s.lastError ? (
														<div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
															<p className="font-semibold">Last fetch failed</p>
															<p className="mt-0.5 font-mono text-[11px]">
																{s.lastError}
															</p>
														</div>
													) : s.content.trim() ? (
														<div>
															<p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
																Fetched content preview
															</p>
															<div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
																{s.content.slice(0, 1200)}
																{s.content.length > 1200 && <span>…</span>}
															</div>
														</div>
													) : (
														<p className="text-xs italic text-muted-foreground">
															No content captured yet.
														</p>
													)}
												</div>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>
		</>
	);
}
