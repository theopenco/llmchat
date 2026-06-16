"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { resolveSelectedId } from "@/lib/selection";
import { useWorkspace } from "@/lib/workspace";

import { ConversationList } from "./_components/ConversationList";
import { ConversationListSkeleton } from "./_components/ConversationListSkeleton";
import { DetailPanel } from "./_components/DetailPanel";
import { NoProjectsEmpty, NoWorkspaceEmpty } from "./_components/empty-states";
import { initials, pluralize } from "./_components/format";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { InboxStats } from "./_components/InboxStats";
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
	const [search, setSearch] = useState("");
	const [showArchived, setShowArchived] = useState(false);
	const [sending, setSending] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [deleting, setDeleting] = useState(false);

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
				`/api/projects/${projectId}/conversations?limit=100`,
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

	const allConversations = useMemo(
		() => conversations.data?.conversations ?? [],
		[conversations.data],
	);

	// Left list: archived view vs active, then a client-side text filter over the
	// fields the visitor sees (name, email, first message).
	const visibleConversations = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return allConversations
			.filter((c) => (showArchived ? c.archivedAt : !c.archivedAt))
			.filter((c) => {
				if (!needle) return true;
				return [c.name, c.email, c.firstMessage]
					.filter(Boolean)
					.some((field) => field!.toLowerCase().includes(needle));
			});
	}, [allConversations, search, showArchived]);

	const selectedConv = allConversations.find((c) => c.id === selectedId);
	const detailConv = thread.data?.conversation ?? selectedConv ?? null;

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
		if (!reply.trim() || !projectId || !selectedId || !workspaceId) return;
		setSending(true);
		try {
			await api(
				`/api/projects/${projectId}/conversations/${selectedId}/reply`,
				{ method: "POST", body: { content: reply.trim() }, workspaceId },
			);
			setReply("");
			toast.success("Reply sent");
			await thread.refetch();
			await conversations.refetch();
		} catch (e) {
			toast.error("Failed to send reply", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setSending(false);
		}
	}

	async function handleArchive() {
		if (!projectId || !detailConv || !workspaceId) return;
		const nextArchived = !detailConv.archivedAt;
		setArchiving(true);
		try {
			await api(`/api/projects/${projectId}/conversations/${detailConv.id}`, {
				method: "PATCH",
				body: { archived: nextArchived },
				workspaceId,
			});
			toast.success(
				nextArchived ? "Conversation archived" : "Conversation restored",
			);
			setSelectedId(null);
			await conversations.refetch();
		} catch (e) {
			toast.error("Failed to update conversation", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setArchiving(false);
		}
	}

	async function handleDelete() {
		if (!projectId || !detailConv || !workspaceId) return;
		setDeleting(true);
		try {
			await api(`/api/projects/${projectId}/conversations/${detailConv.id}`, {
				method: "DELETE",
				workspaceId,
			});
			toast.success("Conversation deleted");
			setSelectedId(null);
			await conversations.refetch();
		} catch (e) {
			toast.error("Failed to delete conversation", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setDeleting(false);
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
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			<InboxStats conversations={allConversations} />

			<div className="flex min-h-0 flex-1">
				{/* Left — list */}
				<div className="flex w-80 shrink-0 flex-col border-r">
					<ProjectSwitcher
						projects={projects.data.projects}
						value={projectId}
						onChange={handleProjectChange}
					/>
					{conversations.isLoading ? (
						<ConversationListSkeleton />
					) : (
						<ConversationList
							conversations={visibleConversations}
							selectedId={selectedId}
							onSelect={setSelectedId}
							search={search}
							onSearch={setSearch}
							showArchived={showArchived}
							onToggleArchived={() => {
								setShowArchived((v) => !v);
								setSelectedId(null);
							}}
						/>
					)}
				</div>

				{/* Center — thread */}
				<section className="flex min-w-0 flex-1 flex-col">
					{selectedId && detailConv ? (
						<>
							<div className="flex items-center gap-3 border-b px-6 py-3">
								<span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
									{initials(detailConv.name)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{detailConv.name ?? "Anonymous"}
									</p>
									<p className="text-xs text-muted-foreground">
										{pluralize(detailConv.messageCount, "message")}
									</p>
								</div>
								{detailConv.escalatedAt && (
									<Badge variant="warning">Escalated</Badge>
								)}
							</div>
							{thread.data ? (
								<MessageThread messages={thread.data.messages} />
							) : (
								<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
									Loading…
								</div>
							)}
							<ReplyComposer
								value={reply}
								onChange={setReply}
								onSend={handleReply}
								pending={sending}
								placeholder={
									detailConv.email
										? "Reply (also sent via email)"
										: "Reply (no email — shows in the widget on next visit)"
								}
							/>
						</>
					) : (
						<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
							Select a conversation
						</div>
					)}
				</section>

				{/* Right — detail */}
				<aside className="hidden w-72 shrink-0 border-l xl:flex xl:flex-col">
					{detailConv ? (
						<DetailPanel
							conversation={detailConv}
							onArchive={handleArchive}
							onDelete={handleDelete}
							archiving={archiving}
							deleting={deleting}
						/>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
							<p className="text-xs">
								Select a conversation to see visitor details
							</p>
						</div>
					)}
				</aside>
			</div>
		</div>
	);
}
