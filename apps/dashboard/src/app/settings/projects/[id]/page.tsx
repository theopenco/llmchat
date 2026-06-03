"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { SourcesPanel } from "./SourcesPanel";
import { SystemPromptsPanel } from "./SystemPromptsPanel";
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
import { ModelPicker } from "./ModelPicker";
import { Book, Check, ChevronLeft, Copy, Trash2 } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Project {
	id: string;
	name: string;
	publicKey: string;
	systemPrompt: string;
	knowledgeText: string;
	model: string;
	brandColor: string;
	welcomeMessage: string;
	escalationThreshold: number;
	notifyEmail: string | null;
	slackWebhookUrl: string | null;
}

export default function ProjectSettingsPage() {
	const { id } = useParams<{ id: string }>();
	const { workspaceId } = useWorkspace();
	const router = useRouter();
	const qc = useQueryClient();
	const [draft, setDraft] = useState<Partial<Project>>({});
	const [showDelete, setShowDelete] = useState(false);
	const [copied, setCopied] = useState(false);

	const project = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
		select: (d) => d.projects.find((p) => p.id === id),
	});

	useEffect(() => {
		if (project.data) {
			setDraft(project.data);
		}
	}, [project.data]);

	const save = useMutation({
		mutationFn: (input: Partial<Project>) =>
			api(`/api/projects/${id}`, {
				method: "PATCH",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			toast.success("Project saved");
		},
		onError: (e) =>
			toast.error("Save failed", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const remove = useMutation({
		mutationFn: () =>
			api(`/api/projects/${id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			toast.success("Project deleted");
			router.push("/settings/projects");
		},
		onError: (e) =>
			toast.error("Delete failed", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	if (!project.data) {
		return (
			<div className="mx-auto max-w-4xl px-6 py-10">
				<div className="space-y-6">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-64 w-full rounded-2xl" />
				</div>
			</div>
		);
	}

	const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
	const embed = `<script src="${apiUrl}/widget.js" data-project="${project.data.publicKey}" data-api="${apiUrl}" data-brand="${draft.brandColor ?? project.data.brandColor}"></script>`;

	function copyEmbed() {
		navigator.clipboard.writeText(embed);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
		toast.success("Embed snippet copied");
	}

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<div className="mb-8">
				<Link
					href="/settings/projects"
					className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
					Back to Projects
				</Link>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className="size-4 rounded-full"
							style={{ backgroundColor: draft.brandColor || "#000" }}
						/>
						<h1 className="text-2xl font-bold tracking-tight">
							{project.data.name}
						</h1>
					</div>
					<Button
						type="button"
						variant="outline"
						className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
						onClick={() => setShowDelete(true)}
					>
						<Trash2 />
						Delete Project
					</Button>
				</div>
			</div>

			<AlertDialog open={showDelete} onOpenChange={setShowDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete &ldquo;{project.data.name}&rdquo;?
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

			<Card className="mb-8">
				<CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
					<CardTitle>Embed Snippet</CardTitle>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={copyEmbed}
					>
						{copied ? <Check /> : <Copy />}
						{copied ? "Copied!" : "Copy"}
					</Button>
				</CardHeader>
				<CardContent>
					<pre className="overflow-x-auto rounded-lg bg-primary p-4 text-xs leading-relaxed text-primary-foreground/80">
						{embed}
					</pre>
				</CardContent>
			</Card>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					save.mutate(draft);
				}}
				className="flex flex-col gap-8"
			>
				<Card>
					<CardHeader>
						<CardTitle>General</CardTitle>
						<CardDescription>Basic project configuration</CardDescription>
					</CardHeader>
					<Separator />
					<CardContent className="flex flex-col gap-5 pt-5">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="name">Project name</Label>
							<Input
								id="name"
								value={draft.name ?? ""}
								onChange={(e) => setDraft({ ...draft, name: e.target.value })}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="model">Model</Label>
							<ModelPicker
								value={draft.model ?? ""}
								onChange={(modelId) => setDraft({ ...draft, model: modelId })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-5">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="brandColor">Brand color</Label>
								<div className="flex items-center gap-3">
									<Input
										id="brandColor"
										type="color"
										value={draft.brandColor ?? "#000000"}
										onChange={(e) =>
											setDraft({ ...draft, brandColor: e.target.value })
										}
										className="size-10 cursor-pointer p-1"
									/>
									<span className="font-mono text-sm text-muted-foreground">
										{draft.brandColor ?? "#000000"}
									</span>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="threshold">Escalation threshold</Label>
								<p className="text-xs text-muted-foreground">
									Messages before escalation
								</p>
								<Input
									id="threshold"
									type="number"
									min={1}
									value={draft.escalationThreshold ?? 3}
									onChange={(e) =>
										setDraft({
											...draft,
											escalationThreshold: parseInt(e.target.value, 10),
										})
									}
								/>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="welcome">Welcome message</Label>
							<Input
								id="welcome"
								value={draft.welcomeMessage ?? ""}
								onChange={(e) =>
									setDraft({ ...draft, welcomeMessage: e.target.value })
								}
								placeholder="Hi! How can I help you today?"
							/>
						</div>
					</CardContent>
				</Card>

				<SystemPromptsPanel projectId={id} workspaceId={workspaceId!} />

				<SourcesPanel projectId={id} workspaceId={workspaceId!} />

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<div className="flex size-7 items-center justify-center rounded-lg bg-warning text-warning-foreground">
								<Book className="size-3.5" />
							</div>
							<div>
								<CardTitle>Knowledge Base</CardTitle>
								<CardDescription>
									Reference content the AI uses to answer questions
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<Separator />
					<CardContent className="pt-5">
						<div className="mb-2 flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Markdown content
							</span>
							<Badge variant="secondary">
								{(draft.knowledgeText ?? "").length} chars
							</Badge>
						</div>
						<Textarea
							id="knowledge"
							rows={12}
							value={draft.knowledgeText ?? ""}
							onChange={(e) =>
								setDraft({ ...draft, knowledgeText: e.target.value })
							}
							placeholder={
								"# Frequently Asked Questions\n\n## How do I reset my password?\nGo to Settings → Account → Reset Password.\n\n## What are your business hours?\nMonday–Friday, 9am–5pm EST."
							}
							className="font-mono"
						/>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Notifications</CardTitle>
						<CardDescription>Where to send escalation alerts</CardDescription>
					</CardHeader>
					<Separator />
					<CardContent className="flex flex-col gap-5 pt-5">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="notifyEmail">Notify email</Label>
							<p className="text-xs text-muted-foreground">
								Receives escalation notifications
							</p>
							<Input
								id="notifyEmail"
								type="email"
								value={draft.notifyEmail ?? ""}
								onChange={(e) =>
									setDraft({
										...draft,
										notifyEmail: e.target.value || null,
									})
								}
								placeholder="team@company.com"
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="slack">Slack webhook URL</Label>
							<p className="text-xs text-muted-foreground">
								Optional Slack integration
							</p>
							<Input
								id="slack"
								type="url"
								value={draft.slackWebhookUrl ?? ""}
								onChange={(e) =>
									setDraft({
										...draft,
										slackWebhookUrl: e.target.value || null,
									})
								}
								placeholder="https://hooks.slack.com/services/..."
							/>
						</div>
					</CardContent>
				</Card>

				<div className="sticky bottom-6 flex items-center justify-end gap-3 rounded-2xl border bg-background/80 px-6 py-4 shadow-lg backdrop-blur-md">
					<Button type="button" variant="ghost" asChild>
						<Link href="/settings/projects">Cancel</Link>
					</Button>
					<Button type="submit" disabled={save.isPending}>
						{save.isPending ? "Saving…" : "Save Changes"}
					</Button>
				</div>
			</form>
		</div>
	);
}
