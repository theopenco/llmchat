"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { api, describeApiError } from "@/lib/api";
import { resolveOnboardingState } from "@/lib/onboarding";
import { dropById, useOptimisticMutation } from "@/lib/optimistic";
import { resolveSelectedId } from "@/lib/selection";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

import { ConversationList } from "./_components/ConversationList";
import { ConversationListSkeleton } from "./_components/ConversationListSkeleton";
import { DetailPanel } from "./_components/DetailPanel";
import { initials, parseDevice, pluralize } from "./_components/format";
import { InboxPanes } from "./_components/InboxPanes";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { InboxStats } from "./_components/InboxStats";
import { InboxToolbar } from "./_components/InboxToolbar";
import { MessageThread } from "./_components/MessageThread";
import { appendOptimisticReply } from "./_components/optimistic-updaters";
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
	// Contact-details sheet (mobile/tablet); on desktop details are a permanent aside.
	const [detailsOpen, setDetailsOpen] = useState(false);

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

	// Optimistic reply: the agent's message appears in the thread the instant they
	// hit send (a temp admin bubble that stick-to-bottom follows), then the real
	// row replaces it on reconcile. A failed send rolls the bubble back and keeps
	// the typed text so it can be retried.
	const replyMut = useOptimisticMutation<{
		tempId: string;
		content: string;
		createdAt: string;
	}>({
		queryKey: ["thread", projectId, selectedId],
		apply: (prev, vars) => appendOptimisticReply(prev, vars),
		mutationFn: (vars) =>
			api(`/api/projects/${projectId}/conversations/${selectedId}/reply`, {
				method: "POST",
				body: { content: vars.content },
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			setReply("");
			toast.success("Reply sent");
			// The reply bumps updatedAt + the preview, so refresh the list order too.
			void qc.invalidateQueries({ queryKey: ["conversations", projectId] });
		},
		onError: (e) => toast.error(describeApiError(e, "Failed to send reply")),
	});

	// Optimistic archive/restore + delete: the row leaves the current list the
	// instant the action fires; a failure re-inserts it (and toasts).
	const archiveMut = useOptimisticMutation<{
		id: string;
		nextArchived: boolean;
	}>({
		queryKey: ["conversations", projectId],
		apply: (prev, vars) => dropById(prev, "conversations", vars.id),
		mutationFn: (vars) =>
			api(`/api/projects/${projectId}/conversations/${vars.id}`, {
				method: "PATCH",
				body: { archived: vars.nextArchived },
				workspaceId: workspaceId!,
			}),
		onSuccess: (_data, vars) =>
			toast.success(
				vars.nextArchived ? "Conversation archived" : "Conversation restored",
			),
		onError: (e) =>
			toast.error(describeApiError(e, "Failed to update conversation")),
	});

	const deleteMut = useOptimisticMutation<string>({
		queryKey: ["conversations", projectId],
		apply: (prev, id) => dropById(prev, "conversations", id),
		mutationFn: (id) =>
			api(`/api/projects/${projectId}/conversations/${id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => toast.success("Conversation deleted"),
		onError: (e) =>
			toast.error(describeApiError(e, "Failed to delete conversation")),
	});

	function handleReply() {
		const content = reply.trim();
		if (!content || !projectId || !selectedId || !workspaceId) return;
		replyMut.mutate({
			tempId: `temp-${crypto.randomUUID()}`,
			content,
			createdAt: new Date().toISOString(),
		});
	}

	function handleArchive() {
		if (!projectId || !detailConv || !workspaceId) return;
		const { id } = detailConv;
		const nextArchived = !detailConv.archivedAt;
		// Close the pane optimistically alongside the row removal.
		setSelectedId(null);
		setDetailsOpen(false);
		archiveMut.mutate({ id, nextArchived });
	}

	function handleDelete() {
		if (!projectId || !detailConv || !workspaceId) return;
		const { id } = detailConv;
		setSelectedId(null);
		setDetailsOpen(false);
		deleteMut.mutate(id);
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

	// A conversation is open. Drives one-pane-at-a-time on mobile: while open, the
	// list-scoped header/toolbar give way to the full-screen thread.
	const threadOpen = Boolean(selectedId && detailConv);

	return (
		<div className="flex h-[calc(100dvh-3rem)] flex-col md:h-[calc(100vh-3.5rem)]">
			{/* Header band + toolbar are list-scoped: hidden on mobile while a thread
			    is open (the thread takes the full screen), always shown from md. */}
			<div className={cn(threadOpen && "hidden md:block")}>
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
			</div>

			<InboxPanes
				hasSelection={threadOpen}
				onBack={() => setSelectedId(null)}
				detailsOpen={detailsOpen}
				onDetailsOpenChange={setDetailsOpen}
				list={
					<>
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
					</>
				}
				threadHeader={
					detailConv && (
						<>
							<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
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
								<Badge variant="warning" className="shrink-0">
									Escalated
								</Badge>
							)}
						</>
					)
				}
				threadBody={
					detailConv &&
					(thread.data ? (
						<MessageThread
							messages={thread.data.messages}
							search={debouncedSearch}
						/>
					) : (
						<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
							Loading…
						</div>
					))
				}
				composer={
					detailConv && (
						<ReplyComposer
							value={reply}
							onChange={setReply}
							onSend={handleReply}
							pending={replyMut.isPending}
							placeholder={
								detailConv.email
									? "Reply (also sent via email)"
									: "Reply (no email — shows in the widget on next visit)"
							}
						/>
					)
				}
				details={
					detailConv ? (
						<DetailPanel
							conversation={detailConv}
							onArchive={handleArchive}
							onDelete={handleDelete}
							archiving={archiveMut.isPending}
							deleting={deleteMut.isPending}
						/>
					) : null
				}
				emptyState={
					<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
						Select a conversation
					</div>
				}
				detailsEmptyState={
					<div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
						<p className="text-xs">
							Select a conversation to see visitor details
						</p>
					</div>
				}
			/>
		</div>
	);
}
