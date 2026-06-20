"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { api, describeApiError } from "@/lib/api";
import { resolveOnboardingState } from "@/lib/onboarding";
import { resolveSelectedId } from "@/lib/selection";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

import { ConversationList } from "./_components/ConversationList";
import { ConversationListSkeleton } from "./_components/ConversationListSkeleton";
import { DetailPanel } from "./_components/DetailPanel";
import { initials, parseDevice, pluralize } from "./_components/format";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { InboxStats } from "./_components/InboxStats";
import { InboxToolbar } from "./_components/InboxToolbar";
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
	const router = useRouter();
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

	// Debounce the search term so a server query only fires once the agent pauses
	// typing — the term is matched server-side (visitor name/email + message body)
	// and drives the conversation list + the per-row match snippets.
	const debouncedSearch = useDebouncedValue(search.trim(), 250);

	const conversations = useQuery({
		queryKey: ["conversations", projectId, debouncedSearch, showArchived],
		enabled: !!projectId && !!workspaceId,
		refetchInterval: 5_000,
		queryFn: () => {
			const params = new URLSearchParams({ limit: "100" });
			if (debouncedSearch) params.set("search", debouncedSearch);
			if (showArchived) params.set("archived", "true");
			return api<{ conversations: Conversation[] }>(
				`/api/projects/${projectId}/conversations?${params.toString()}`,
				{ workspaceId: workspaceId! },
			);
		},
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

	// Both filters are server-side now: text search (name/email/message body) and
	// the active-vs-archived split. The returned rows are exactly what the list
	// should show, so there's no client-side filtering left to do.
	const allConversations = useMemo(
		() => conversations.data?.conversations ?? [],
		[conversations.data],
	);

	const selectedConv = allConversations.find((c) => c.id === selectedId);
	const detailConv = thread.data?.conversation ?? selectedConv ?? null;

	// Mark a conversation read for this user (existing readStatus PATCH), then
	// refresh the list so its unread dot clears. Best-effort: a failure just
	// leaves the dot.
	const markRead = useCallback(
		async (id: string) => {
			if (!projectId || !workspaceId) return;
			try {
				await api(`/api/projects/${projectId}/conversations/${id}`, {
					method: "PATCH",
					body: { read: true },
					workspaceId,
				});
				await qc.invalidateQueries({ queryKey: ["conversations", projectId] });
			} catch {
				/* non-critical */
			}
		},
		[projectId, workspaceId, qc],
	);

	function handleSelect(id: string) {
		setSelectedId(id);
		void markRead(id);
		const c = allConversations.find((x) => x.id === id);
		track(ANALYTICS_EVENTS.conversationOpened, {
			conversation_id: id,
			escalated: !!c?.escalatedAt,
		});
	}

	// Keep it read as new messages stream in while the thread is open. Keyed on
	// the loaded message count so it fires on new messages, not every poll.
	const loadedMessageCount = thread.data?.messages.length;
	useEffect(() => {
		if (selectedId && loadedMessageCount !== undefined) {
			void markRead(selectedId);
		}
	}, [selectedId, loadedMessageCount, markRead]);

	// A brand-new account (no workspace or no project) belongs in onboarding,
	// not the empty inbox.
	const onboardingState = resolveOnboardingState({
		loading: workspacesLoading || (!!workspaceId && projects.isLoading),
		hasWorkspace: workspaces.length > 0,
		projectCount: projects.data?.projects.length ?? 0,
	});
	useEffect(() => {
		if (onboardingState === "needs-onboarding") router.replace("/onboarding");
	}, [onboardingState, router]);

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
			toast.error(describeApiError(e, "Failed to send reply"));
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
			toast.error(describeApiError(e, "Failed to update conversation"));
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
			toast.error(describeApiError(e, "Failed to delete conversation"));
		} finally {
			setDeleting(false);
		}
	}

	// Loading, or redirecting a brand-new account to onboarding.
	if (onboardingState !== "ready") {
		return <InboxSkeleton />;
	}

	const threadSubtitle =
		[detailConv?.email, parseDevice(detailConv?.userAgent)]
			.filter(Boolean)
			.join(" · ") ||
		(detailConv ? pluralize(detailConv.messageCount, "message") : "");

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			{/* Header band — title + at-a-glance stats */}
			<header className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
				<div>
					<h1 className="font-display text-2xl font-semibold tracking-tight-display">
						Conversations
					</h1>
					<p className="mt-0.5 text-sm text-muted-foreground">
						All visitor conversations in one inbox.
					</p>
				</div>
				<InboxStats conversations={allConversations} />
			</header>

			<InboxToolbar
				search={search}
				onSearch={setSearch}
				showArchived={showArchived}
				onShowArchivedChange={(archived) => {
					setShowArchived(archived);
					setSelectedId(null);
				}}
			/>

			<div className="flex min-h-0 flex-1">
				{/* Left — list */}
				<div className="flex w-80 shrink-0 flex-col border-r">
					<ProjectSwitcher
						projects={projects.data?.projects ?? []}
						value={projectId}
						onChange={handleProjectChange}
					/>
					{conversations.isLoading ? (
						<ConversationListSkeleton />
					) : (
						<ConversationList
							conversations={allConversations}
							selectedId={selectedId}
							onSelect={handleSelect}
							search={debouncedSearch}
							showArchived={showArchived}
						/>
					)}
				</div>

				{/* Center — thread */}
				<section className="flex min-w-0 flex-1 flex-col">
					{selectedId && detailConv ? (
						<>
							<div className="flex items-center gap-3 border-b px-6 py-3">
								<span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
									{initials(detailConv.name)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold">
										{detailConv.name ?? "Anonymous"}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{threadSubtitle}
									</p>
								</div>
								{detailConv.escalatedAt && (
									<Badge variant="warning">Escalated</Badge>
								)}
							</div>
							{thread.data ? (
								<MessageThread
									messages={thread.data.messages}
									search={debouncedSearch}
								/>
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
