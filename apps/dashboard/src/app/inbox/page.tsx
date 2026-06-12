"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

import { ConversationList } from "./_components/ConversationList";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { MessageThread } from "./_components/MessageThread";
import { ReplyComposer } from "./_components/ReplyComposer";
import type { Conversation, Message } from "./_components/types";

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

	// Pick the first project of the current workspace, and re-pick whenever the
	// selected project no longer belongs to it (e.g. after a workspace switch).
	useEffect(() => {
		const list = projects.data?.projects;
		if (!list?.length) return;
		if (!projectId || !list.some((p) => p.id === projectId)) {
			setProjectId(list[0]!.id);
			setSelectedId(null);
		}
	}, [projects.data, projectId]);

	function handleProjectChange(id: string) {
		setProjectId(id);
		setSelectedId(null);
	}

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
		return <InboxSkeleton />;
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
			<div className="flex min-h-0 flex-col border-r">
				<div className="border-b p-3">
					<Select
						value={projectId ?? undefined}
						onValueChange={handleProjectChange}
					>
						<SelectTrigger className="w-full" aria-label="Project">
							<SelectValue placeholder="Select a project" />
						</SelectTrigger>
						<SelectContent>
							{projects.data.projects.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<ConversationList
					conversations={conversations.data?.conversations ?? []}
					selectedId={selectedId}
					onSelect={setSelectedId}
				/>
			</div>
			<section className="flex flex-col">
				{selectedId && thread.data ? (
					<>
						<MessageThread messages={thread.data.messages} />
						<Separator />
						<ReplyComposer
							value={reply}
							onChange={setReply}
							onSend={handleReply}
							placeholder={
								thread.data.conversation.email
									? "Reply (sent via email)"
									: "Reply (visitor has no email — will show in widget on next visit)"
							}
						/>
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
