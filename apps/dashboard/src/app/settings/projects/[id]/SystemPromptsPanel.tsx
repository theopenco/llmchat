"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";

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
	Sparkles,
	Plus,
	Star,
	Trash2,
	Check,
	Search,
	LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface SystemPrompt {
	id: string;
	projectId: string;
	name: string;
	content: string;
	favorite: boolean;
	createdAt: string;
	updatedAt: string;
}

interface PromptsResponse {
	prompts: SystemPrompt[];
	activeSystemPromptId: string | null;
}

const TEMPLATES = [
	{
		label: "Support Agent",
		emoji: "🛟",
		content:
			"You are a friendly and professional customer support assistant. Answer questions accurately using the knowledge base provided. If you don't know the answer, offer to connect the user with a human agent. Never make up information.",
	},
	{
		label: "Sales Helper",
		emoji: "💼",
		content:
			"You are a knowledgeable sales assistant. Help potential customers understand the product, answer their questions, and guide them toward the right solution. Be enthusiastic but honest about capabilities.",
	},
	{
		label: "Technical Docs",
		emoji: "📚",
		content:
			"You are a technical documentation assistant. Provide clear, accurate answers about the product's features and APIs. Use code examples when helpful. Point users to relevant documentation sections.",
	},
	{
		label: "Onboarding",
		emoji: "✨",
		content:
			"You are an onboarding specialist. Guide new users through getting started, answer setup questions, and proactively suggest next steps based on what they're trying to accomplish.",
	},
];

type FilterMode = "all" | "favorites" | "active";

export function SystemPromptsPanel({
	projectId,
	workspaceId,
}: {
	projectId: string;
	workspaceId: string;
}) {
	const qc = useQueryClient();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editContent, setEditContent] = useState("");
	const [dirty, setDirty] = useState(false);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<FilterMode>("all");
	const [showTemplates, setShowTemplates] = useState(false);
	const [showDiscard, setShowDiscard] = useState<SystemPrompt | null>(null);
	const [showDelete, setShowDelete] = useState(false);

	const promptsQ = useQuery({
		queryKey: ["system-prompts", projectId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<PromptsResponse>(`/api/projects/${projectId}/system-prompts`, {
				workspaceId,
			}),
	});

	const prompts = promptsQ.data?.prompts ?? [];
	const activeId = promptsQ.data?.activeSystemPromptId ?? null;
	const selected = prompts.find((p) => p.id === selectedId) ?? null;

	const sorted = useMemo(() => {
		return [...prompts].sort((a, b) => {
			if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
			return a.createdAt.localeCompare(b.createdAt);
		});
	}, [prompts]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return sorted.filter((p) => {
			if (filter === "favorites" && !p.favorite) return false;
			if (filter === "active" && p.id !== activeId) return false;
			if (!q) return true;
			return (
				p.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
			);
		});
	}, [sorted, search, filter, activeId]);

	const favCount = prompts.filter((p) => p.favorite).length;

	useEffect(() => {
		if (!promptsQ.data) return;
		if (selectedId && prompts.some((p) => p.id === selectedId)) return;
		const next = activeId ? prompts.find((p) => p.id === activeId) : sorted[0];
		if (next) {
			setSelectedId(next.id);
			setEditName(next.name);
			setEditContent(next.content);
			setDirty(false);
		} else {
			setSelectedId(null);
		}
	}, [promptsQ.data, activeId, prompts, sorted, selectedId]);

	function applyPick(p: SystemPrompt) {
		setSelectedId(p.id);
		setEditName(p.name);
		setEditContent(p.content);
		setDirty(false);
	}
	function pick(p: SystemPrompt) {
		if (dirty) {
			setShowDiscard(p);
			return;
		}
		applyPick(p);
	}

	const createM = useMutation({
		mutationFn: (input: { name: string; content: string }) =>
			api<{ prompt: SystemPrompt }>(
				`/api/projects/${projectId}/system-prompts`,
				{ method: "POST", body: input, workspaceId },
			),
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["system-prompts", projectId] });
			setSelectedId(res.prompt.id);
			setEditName(res.prompt.name);
			setEditContent(res.prompt.content);
			setDirty(false);
			setShowTemplates(false);
			toast.success("Prompt created");
		},
		onError: (e) =>
			toast.error("Failed to create prompt", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const saveM = useMutation({
		mutationFn: () =>
			api<{ prompt: SystemPrompt }>(
				`/api/projects/${projectId}/system-prompts/${selectedId}`,
				{
					method: "PATCH",
					body: { name: editName, content: editContent },
					workspaceId,
				},
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["system-prompts", projectId] });
			setDirty(false);
			toast.success("Prompt saved");
		},
		onError: (e) =>
			toast.error("Save failed", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const activateM = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${projectId}/system-prompts/${id}/activate`, {
				method: "POST",
				workspaceId,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["system-prompts", projectId] });
			qc.invalidateQueries({ queryKey: ["projects"] });
			toast.success("Active prompt updated");
		},
		onError: (e) =>
			toast.error("Failed to activate", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const favoriteM = useMutation({
		mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
			api(`/api/projects/${projectId}/system-prompts/${id}`, {
				method: "PATCH",
				body: { favorite },
				workspaceId,
			}),
		onMutate: async ({ id, favorite }) => {
			await qc.cancelQueries({
				queryKey: ["system-prompts", projectId],
			});
			const prev = qc.getQueryData<PromptsResponse>([
				"system-prompts",
				projectId,
			]);
			if (prev) {
				qc.setQueryData<PromptsResponse>(["system-prompts", projectId], {
					...prev,
					prompts: prev.prompts.map((p) =>
						p.id === id ? { ...p, favorite } : p,
					),
				});
			}
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) qc.setQueryData(["system-prompts", projectId], ctx.prev);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["system-prompts", projectId] });
		},
	});

	const deleteM = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${projectId}/system-prompts/${id}`, {
				method: "DELETE",
				workspaceId,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["system-prompts", projectId] });
			setSelectedId(null);
			toast.success("Prompt deleted");
		},
		onError: (e) =>
			toast.error("Delete failed", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	function createBlank() {
		createM.mutate({
			name: `Prompt ${prompts.length + 1}`,
			content: "",
		});
	}

	function createFromTemplate(t: (typeof TEMPLATES)[number]) {
		createM.mutate({ name: t.label, content: t.content });
	}

	return (
		<>
			<AlertDialog
				open={showDiscard !== null}
				onOpenChange={(open) => !open && setShowDiscard(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved edits. Switching prompts will lose them.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								if (showDiscard) applyPick(showDiscard);
								setShowDiscard(null);
							}}
						>
							Discard
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<AlertDialog open={showDelete} onOpenChange={setShowDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete &ldquo;{selected?.name}&rdquo;?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This prompt will be removed permanently.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								if (selected) deleteM.mutate(selected.id);
								setShowDelete(false);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Card className="overflow-hidden">
				<CardHeader className="flex-row items-center gap-3 space-y-0">
					<div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
						<Sparkles className="size-4" />
					</div>
					<div className="flex-1">
						<CardTitle>System Prompts</CardTitle>
						<CardDescription>
							Create multiple prompts, star your favorites, pick one to use.
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setShowTemplates((v) => !v)}
						>
							<LayoutTemplate />
							Templates
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={createBlank}
							disabled={createM.isPending}
						>
							<Plus />
							New Prompt
						</Button>
					</div>
				</CardHeader>
				{showTemplates && (
					<>
						<Separator />
						<CardContent className="px-6 py-3">
							<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{TEMPLATES.map((t) => (
									<button
										key={t.label}
										type="button"
										onClick={() => createFromTemplate(t)}
										disabled={createM.isPending}
										className="group flex items-start gap-2 rounded-lg border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md disabled:opacity-50"
									>
										<span className="text-lg leading-none">{t.emoji}</span>
										<div className="min-w-0 flex-1">
											<p className="text-xs font-semibold group-hover:text-primary">
												{t.label}
											</p>
											<p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
												{t.content.slice(0, 70)}…
											</p>
										</div>
									</button>
								))}
							</div>
						</CardContent>
					</>
				)}
				<Separator />
				<div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
					<aside className="flex flex-col border-b md:border-b-0 md:border-r">
						<div className="flex flex-col gap-2 border-b p-3">
							<div className="relative">
								<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search prompts…"
									className="h-9 pl-8 text-xs"
								/>
							</div>
							<ToggleGroup
								type="single"
								value={filter}
								onValueChange={(v) => v && setFilter(v as FilterMode)}
								size="sm"
								className="w-full"
							>
								<ToggleGroupItem value="all" className="flex-1">
									All
									<span className="ml-1 text-muted-foreground">
										{prompts.length}
									</span>
								</ToggleGroupItem>
								<ToggleGroupItem value="favorites" className="flex-1">
									Starred
									<span className="ml-1 text-muted-foreground">{favCount}</span>
								</ToggleGroupItem>
								<ToggleGroupItem value="active" className="flex-1">
									Active
									<span className="ml-1 text-muted-foreground">
										{activeId ? 1 : 0}
									</span>
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
						<div className="flex-1 overflow-y-auto p-2">
							{promptsQ.isLoading ? (
								<div className="flex flex-col gap-2 p-1">
									{[1, 2, 3].map((i) => (
										<Skeleton key={i} className="h-16 w-full" />
									))}
								</div>
							) : prompts.length === 0 ? (
								<Empty className="border-0 py-8">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<Sparkles />
										</EmptyMedia>
										<EmptyTitle>No prompts yet</EmptyTitle>
										<EmptyDescription>
											Pick a template or create your own.
										</EmptyDescription>
									</EmptyHeader>
									<EmptyContent>
										<Button
											type="button"
											size="sm"
											onClick={() => setShowTemplates(true)}
										>
											Browse templates
										</Button>
									</EmptyContent>
								</Empty>
							) : filtered.length === 0 ? (
								<p className="px-2 py-6 text-center text-xs text-muted-foreground">
									No matches
								</p>
							) : (
								<ul className="flex flex-col gap-1">
									{filtered.map((p) => {
										const isActive = p.id === activeId;
										const isSelected = p.id === selectedId;
										return (
											<li key={p.id}>
												<div
													className={cn(
														"group relative flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-all",
														isSelected
															? "border-primary/30 bg-background shadow-sm"
															: "border-transparent hover:bg-background hover:shadow-sm",
													)}
												>
													{isActive && (
														<span
															aria-hidden
															className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-success"
														/>
													)}
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className={cn(
															"mt-0.5 size-7",
															p.favorite
																? "text-warning hover:text-warning"
																: "text-muted-foreground/40 hover:text-warning",
														)}
														onClick={(e) => {
															e.stopPropagation();
															favoriteM.mutate({
																id: p.id,
																favorite: !p.favorite,
															});
														}}
														title={p.favorite ? "Unstar" : "Star"}
													>
														<Star
															className={cn(p.favorite && "fill-warning")}
														/>
													</Button>
													<button
														type="button"
														onClick={() => pick(p)}
														className="min-w-0 flex-1 text-left"
													>
														<div className="flex items-center justify-between gap-2">
															<span
																className={cn(
																	"truncate text-sm font-medium",
																	isSelected
																		? "text-foreground"
																		: "text-foreground/80",
																)}
															>
																{p.name}
															</span>
															{isActive && (
																<Badge variant="success">Active</Badge>
															)}
														</div>
														<p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
															{p.content.trim() || (
																<span className="italic">Empty prompt</span>
															)}
														</p>
													</button>
												</div>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</aside>
					<div className="p-5">
						{!selected ? (
							<Empty className="border-0 py-12">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Sparkles />
									</EmptyMedia>
									<EmptyTitle>Pick or create a prompt</EmptyTitle>
									<EmptyDescription>
										Your AI assistant will use the prompt marked as Active.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						) : (
							<div className="flex flex-col gap-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className={cn(
												"size-8",
												selected.favorite
													? "text-warning hover:text-warning"
													: "text-muted-foreground/40 hover:text-warning",
											)}
											onClick={() =>
												favoriteM.mutate({
													id: selected.id,
													favorite: !selected.favorite,
												})
											}
											title={selected.favorite ? "Unstar" : "Star"}
										>
											<Star
												className={cn(selected.favorite && "fill-warning")}
											/>
										</Button>
										<Input
											value={editName}
											onChange={(e) => {
												setEditName(e.target.value);
												setDirty(true);
											}}
											placeholder="Prompt name"
											className="h-9 border-transparent bg-transparent text-base font-semibold focus-visible:border-input"
										/>
									</div>
									<div className="flex items-center gap-2">
										{selected.id === activeId ? (
											<Badge variant="success">
												<Check />
												Active prompt
											</Badge>
										) : (
											<Button
												type="button"
												size="sm"
												onClick={() => activateM.mutate(selected.id)}
												disabled={activateM.isPending}
											>
												<Check />
												{activateM.isPending ? "Activating…" : "Set as Active"}
											</Button>
										)}
										<Button
											type="button"
											variant="outline"
											size="icon"
											onClick={() => {
												if (prompts.length <= 1) {
													toast.error("Can't delete the only prompt");
													return;
												}
												setShowDelete(true);
											}}
											disabled={deleteM.isPending || prompts.length <= 1}
											className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											title={
												prompts.length <= 1
													? "At least one prompt is required"
													: "Delete prompt"
											}
										>
											<Trash2 />
										</Button>
									</div>
								</div>
								<div className="flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<span className="text-xs font-medium text-muted-foreground">
											Prompt content
										</span>
										<div className="flex items-center gap-1.5">
											<Badge variant="secondary">
												{editContent.length} chars
											</Badge>
											<Badge variant="secondary">
												~{Math.ceil(editContent.length / 4)} tok
											</Badge>
										</div>
									</div>
									<Textarea
										rows={12}
										value={editContent}
										onChange={(e) => {
											setEditContent(e.target.value);
											setDirty(true);
										}}
										placeholder={
											"You are a helpful assistant for [Company]…\n\nGuidelines:\n- Be friendly and professional\n- Use the knowledge base\n- Escalate when unsure"
										}
										className="font-mono"
									/>
								</div>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-[11px] text-muted-foreground">
										{dirty ? (
											<span className="text-warning">● Unsaved changes</span>
										) : (
											<>
												Updated{" "}
												{new Date(selected.updatedAt).toLocaleString(
													undefined,
													{
														dateStyle: "medium",
														timeStyle: "short",
													},
												)}
											</>
										)}
									</p>
									<div className="flex items-center gap-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => {
												setEditName(selected.name);
												setEditContent(selected.content);
												setDirty(false);
											}}
											disabled={!dirty || saveM.isPending}
										>
											Revert
										</Button>
										<Button
											type="button"
											size="sm"
											onClick={() => saveM.mutate()}
											disabled={!dirty || saveM.isPending || !editName.trim()}
										>
											{saveM.isPending ? "Saving…" : "Save Prompt"}
										</Button>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</Card>
		</>
	);
}
