"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import Link from "next/link";
import { toast } from "sonner";
import { FolderOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface Conversation {
	id: string;
	name: string | null;
	email: string | null;
	messageCount: number;
	escalatedAt: number | null;
	archivedAt: number | null;
	updatedAt: number;
}

interface Message {
	id: string;
	role: "user" | "assistant" | "admin";
	content: string;
	sequence: number;
	createdAt: number;
}

interface Project {
	id: string;
	name: string;
}

export default function InboxPage() {
	const {
		workspaces,
		workspaceId,
		isLoading: workspacesLoading,
	} = useWorkspace();
	const qc = useQueryClient();
	const [projectId, setProjectId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reply, setReply] = useState("");

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	useEffect(() => {
		if (!projectId && projects.data?.projects[0]) {
			setProjectId(projects.data.projects[0].id);
		}
	}, [projects.data, projectId]);

	const conversations = useQuery({
		queryKey: ["conversations", projectId],
		enabled: !!projectId && !!workspaceId,
		refetchInterval: 5_000,
		queryFn: () =>
			api<{ conversations: Conversation[] }>(
				`/api/projects/${projectId}/conversations`,
				{ workspaceId: workspaceId! },
			),
	});

	const thread = useQuery({
		queryKey: ["thread", projectId, selectedId],
		enabled: !!projectId && !!selectedId && !!workspaceId,
		refetchInterval: 3_000,
		queryFn: () =>
			api<{ conversation: Conversation; messages: Message[] }>(
				`/api/projects/${projectId}/conversations/${selectedId}`,
				{ workspaceId: workspaceId! },
			),
	});

	async function handleReply() {
		if (!reply.trim() || !projectId || !selectedId || !workspaceId) {
			return;
		}
		try {
			await api(
				`/api/projects/${projectId}/conversations/${selectedId}/reply`,
				{
					method: "POST",
					body: { content: reply.trim() },
					workspaceId,
				},
			);
			setReply("");
			toast.success("Reply sent");
			await thread.refetch();
			await conversations.refetch();
		} catch (e) {
			toast.error("Failed to send reply", {
				description: e instanceof Error ? e.message : undefined,
			});
		}
	}

	if (workspacesLoading) {
		return null;
	}

	if (workspaces.length === 0) {
		return (
			<Empty className="m-8">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderOpen />
					</EmptyMedia>
					<EmptyTitle>No workspace yet</EmptyTitle>
					<EmptyDescription>
						Create a workspace to start receiving conversations.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button
						onClick={async () => {
							try {
								await api("/api/workspaces", {
									method: "POST",
									body: { name: "My workspace" },
								});
								await qc.invalidateQueries({ queryKey: ["workspaces"] });
								toast.success("Workspace created");
							} catch (e) {
								toast.error("Failed to create workspace", {
									description: e instanceof Error ? e.message : undefined,
								});
							}
						}}
					>
						Create workspace
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	if (!projects.data?.projects.length) {
		return (
			<Empty className="m-8">
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
					<Button asChild>
						<Link href="/settings/projects">Go to Projects</Link>
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	return (
		<div className="grid h-[calc(100vh-3.5rem)] grid-cols-[20rem_1fr]">
			<aside className="overflow-y-auto border-r bg-background">
				<ul className="flex flex-col">
					{conversations.data?.conversations.map((c) => (
						<li key={c.id}>
							<button
								type="button"
								onClick={() => {
									setSelectedId(c.id);
									track(ANALYTICS_EVENTS.conversationOpened, {
										conversation_id: c.id,
										escalated: !!c.escalatedAt,
									});
								}}
								className={cn(
									"w-full border-b p-3 text-left transition-colors hover:bg-muted",
									selectedId === c.id && "bg-muted",
								)}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="text-sm font-medium">
										{c.name ?? "Anonymous"}
									</span>
									{c.escalatedAt && <Badge variant="warning">escalated</Badge>}
								</div>
								<div className="text-xs text-muted-foreground">
									{c.email ?? "—"}
								</div>
								<div className="text-xs text-muted-foreground/70">
									{c.messageCount} messages
								</div>
							</button>
						</li>
					))}
					{conversations.data?.conversations.length === 0 && (
						<li className="p-4 text-sm text-muted-foreground">
							No conversations yet.
						</li>
					)}
				</ul>
			</aside>
			<section className="flex flex-col">
				{selectedId && thread.data ? (
					<>
						<div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
							{thread.data.messages.map((m) => (
								<div
									key={m.id}
									className={cn(
										"max-w-[70%] rounded-2xl px-3 py-2 text-sm",
										m.role === "user" &&
											"ml-auto bg-primary text-primary-foreground",
										m.role === "admin" &&
											"ml-auto bg-success/15 text-foreground",
										m.role === "assistant" && "bg-muted text-foreground",
									)}
								>
									<div className="mb-0.5 text-xs opacity-70">{m.role}</div>
									<div className="whitespace-pre-wrap">{m.content}</div>
								</div>
							))}
						</div>
						<Separator />
						<div className="flex flex-col gap-2 p-3">
							<Textarea
								rows={2}
								value={reply}
								onChange={(e) => setReply(e.target.value)}
								placeholder={
									thread.data.conversation.email
										? "Reply (sent via email)"
										: "Reply (visitor has no email — will show in widget on next visit)"
								}
							/>
							<div className="flex justify-end">
								<Button
									type="button"
									size="sm"
									onClick={handleReply}
									disabled={!reply.trim()}
								>
									<Send />
									Send
								</Button>
							</div>
						</div>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center text-muted-foreground">
						Select a conversation
					</div>
				)}
			</section>
		</div>
	);
}
