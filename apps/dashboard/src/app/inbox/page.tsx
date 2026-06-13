"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { resolveSelectedId } from "@/lib/selection";
import { useWorkspace } from "@/lib/workspace";

import { ConversationList } from "./_components/ConversationList";
import {
	ConversationListSkeleton,
	ThreadSkeleton,
} from "./_components/ConversationListSkeleton";
import { NoProjectsEmpty, NoWorkspaceEmpty } from "./_components/empty-states";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { MessageThread } from "./_components/MessageThread";
import { ProjectSwitcher } from "./_components/ProjectSwitcher";
import { ReplyComposer } from "./_components/ReplyComposer";
import type { Conversation, Message } from "./_components/types";
import type { ProjectOption } from "./_components/ProjectSwitcher";

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
			api<{ projects: ProjectOption[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	// Keep the selected project valid for the current workspace; a stale id
	// (e.g. after a workspace switch) falls back to the first project.
	useEffect(() => {
		const next = resolveSelectedId(projectId, projects.data?.projects ?? []);
		if (next !== projectId) {
			setProjectId(next);
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

	async function handleCreateWorkspace() {
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
	}

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

	if (workspacesLoading || (!!workspaceId && projects.isLoading)) {
		return <InboxSkeleton />;
	}

	if (workspaces.length === 0) {
		return <NoWorkspaceEmpty onCreate={handleCreateWorkspace} />;
	}

	if (!projects.data?.projects.length) {
		return <NoProjectsEmpty />;
	}

	return (
		<div className="grid h-[calc(100vh-3.5rem)] grid-cols-[20rem_1fr]">
			<div className="flex min-h-0 flex-col border-r">
				<ProjectSwitcher
					projects={projects.data.projects}
					value={projectId}
					onChange={handleProjectChange}
				/>
				{conversations.isLoading ? (
					<ConversationListSkeleton />
				) : (
					<ConversationList
						conversations={conversations.data?.conversations ?? []}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>
				)}
			</div>
			<section className="flex flex-col">
				{selectedId ? (
					thread.data ? (
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
						<ThreadSkeleton />
					)
				) : (
					<div className="flex flex-1 items-center justify-center text-muted-foreground">
						Select a conversation
					</div>
				)}
			</section>
		</div>
	);
}
