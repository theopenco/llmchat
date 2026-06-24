"use client";

import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, api, describeApiError } from "@/lib/api";
import { resolveOnboardingState } from "@/lib/onboarding";
import { useOptimisticMutation } from "@/lib/optimistic";
import { resolveSelectedId } from "@/lib/selection";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

import { ConversationList } from "./_components/ConversationList";
import { ConversationListSkeleton } from "./_components/ConversationListSkeleton";
import {
	addTagToConversation,
	dropConversationFromCache,
	flattenPages,
	mergeConversationPages,
	removeTagFromAllConversations,
	removeTagFromConversation,
	setConversationRead,
	type ConversationPage,
} from "./_components/conversation-list";
import { ManageTagsDialog } from "./_components/ManageTagsDialog";
import { DetailPanel } from "./_components/DetailPanel";
import {
	initials,
	parseDevice,
	pluralize,
	timeAgo,
} from "./_components/format";
import { InboxPanes } from "./_components/InboxPanes";
import { InboxSkeleton } from "./_components/InboxSkeleton";
import { ListFilters } from "./_components/ListFilters";
import { LoadMore } from "./_components/LoadMore";
import { MessageThread } from "./_components/MessageThread";
import { appendOptimisticReply } from "./_components/optimistic-updaters";
import { ProjectSwitcher } from "./_components/ProjectSwitcher";
import { ReplyComposer } from "./_components/ReplyComposer";
import {
	deriveStatus,
	STATUS_PILL,
	type StatusFilter,
} from "./_components/status";
import { ThreadActions } from "./_components/ThreadActions";
import { useThreadMessages } from "./_components/useThreadMessages";
import type { ConversationStats, Tag } from "./_components/types";
import type { ProjectOption } from "./_components/ProjectSwitcher";

const PAGE_SIZE = 30;

export default function InboxPage() {
	const {
		workspaces,
		workspaceId,
		canManage,
		isLoading: workspacesLoading,
	} = useWorkspace();
	const qc = useQueryClient();
	const router = useRouter();
	const [projectId, setProjectId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reply, setReply] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("open");
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [manageTagsOpen, setManageTagsOpen] = useState(false);
	// Contact-details sheet (mobile/tablet); on desktop details are a permanent aside.
	const [detailsOpen, setDetailsOpen] = useState(false);

	// One-time ?project=&c= deep link (from the ⌘K palette or a shared thread
	// URL). Read once on mount; applied after projects load (below) so the
	// project-resolver effect can't clobber it. The thread endpoint re-validates
	// tenancy server-side, so a forged/foreign id just yields an empty thread —
	// never a cross-tenant leak.
	const deepLinkRef = useRef<{
		project: string | null;
		conversation: string | null;
	}>(undefined as never);
	if (deepLinkRef.current === undefined) {
		deepLinkRef.current =
			typeof window === "undefined"
				? { project: null, conversation: null }
				: {
						project: new URLSearchParams(window.location.search).get("project"),
						conversation: new URLSearchParams(window.location.search).get("c"),
					};
	}
	const deepLinkConsumed = useRef(false);

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ProjectOption[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	// Workspace tags drive the toolbar filter + the per-conversation picker.
	const tagsQuery = useQuery({
		queryKey: ["tags", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ tags: Tag[] }>("/api/tags", { workspaceId: workspaceId! }),
	});
	const allTags = tagsQuery.data?.tags ?? [];

	// Keep the selected project valid for the current workspace; a stale id
	// (e.g. after a workspace switch) falls back to the first project.
	useEffect(() => {
		const available = projects.data?.projects ?? [];
		if (available.length === 0) return;

		// One-time: honor the ?project=&c= deep link before the normal resolver, if
		// the project is one the caller can actually see in this workspace.
		if (!deepLinkConsumed.current) {
			deepLinkConsumed.current = true;
			const dl = deepLinkRef.current!;
			if (dl.project && available.some((p) => p.id === dl.project)) {
				setProjectId(dl.project);
				if (dl.conversation) setSelectedId(dl.conversation);
				return;
			}
		}

		const next = resolveSelectedId(projectId, available);
		if (next !== projectId) {
			setProjectId(next);
			setSelectedId(null);
		}
	}, [projects.data, projectId]);

	// Mirror the open conversation into the URL (?project=&c=) so a thread is
	// shareable and the ⌘K deep link round-trips. history.replaceState — not the
	// router — so it never triggers a navigation/refetch.
	useEffect(() => {
		if (typeof window === "undefined" || !projectId) return;
		const params = new URLSearchParams(window.location.search);
		params.set("project", projectId);
		if (selectedId) params.set("c", selectedId);
		else params.delete("c");
		const qs = params.toString();
		window.history.replaceState(
			null,
			"",
			qs ? `?${qs}` : window.location.pathname,
		);
	}, [projectId, selectedId]);

	function handleProjectChange(id: string) {
		setProjectId(id);
		setSelectedId(null);
	}

	// Debounce the search term so a server query only fires once the agent pauses
	// typing — the term is matched server-side (visitor name/email + message body)
	// and drives the conversation list + the per-row match snippets.
	const debouncedSearch = useDebouncedValue(search.trim(), 250);

	// Build the list query string for a given cursor. Search + archived go to the
	// server (pre-resolved before LIMIT), so they compose with keyset paging.
	// Stable joined key for the tag filter so it slots into query keys + params.
	const tagFilterKey = tagIds.join(",");
	const listParams = useCallback(
		(cursor?: string, summarize?: boolean) => {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
			if (debouncedSearch) params.set("search", debouncedSearch);
			params.set("status", status);
			if (tagFilterKey) params.set("tagIds", tagFilterKey);
			if (cursor) params.set("cursor", cursor);
			// Trigger lazy summary generation only on genuine loads/scrolls — never
			// on the 5s head poll, which stays a pure read.
			if (summarize) params.set("summarize", "1");
			return params.toString();
		},
		[debouncedSearch, status, tagFilterKey],
	);

	// The paginated list: keyset cursor, NO polling (a background refetch of an
	// infinite query re-pulls every loaded page). It only fetches on mount and on
	// fetchNextPage.
	const listQuery = useInfiniteQuery({
		queryKey: [
			"conversations",
			projectId,
			"list",
			debouncedSearch,
			status,
			tagFilterKey,
		],
		enabled: !!projectId && !!workspaceId,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			api<ConversationPage>(
				`/api/projects/${projectId}/conversations?${listParams(pageParam, true)}`,
				{ workspaceId: workspaceId! },
			),
		getNextPageParam: (last) => last.nextCursor ?? undefined,
	});

	// The poll lives on a separate HEAD query — just the newest page, every 5s.
	// One O(1) request regardless of how many pages are loaded, so paging never
	// multiplies poll traffic. Merged with the loaded pages at render time.
	const headQuery = useQuery({
		queryKey: [
			"conversations",
			projectId,
			"head",
			debouncedSearch,
			status,
			tagFilterKey,
		],
		enabled: !!projectId && !!workspaceId,
		refetchInterval: 5_000,
		queryFn: () =>
			api<ConversationPage>(
				`/api/projects/${projectId}/conversations?${listParams()}`,
				{ workspaceId: workspaceId! },
			),
	});

	// True project-wide totals for the header — a server aggregate, independent of
	// the loaded pages / search / archived filter, so the stats never read as
	// "loaded so far".
	const statsQuery = useQuery({
		queryKey: ["conversation-stats", projectId],
		enabled: !!projectId && !!workspaceId,
		refetchInterval: 10_000,
		queryFn: () =>
			api<ConversationStats>(`/api/projects/${projectId}/conversations/stats`, {
				workspaceId: workspaceId!,
			}),
	});

	// Windowed thread: latest page first, page older on scroll-up, poll newest
	// only. Stays in the ["thread", projectId, selectedId] cache so the optimistic
	// reply below keeps working unchanged.
	const thread = useThreadMessages({
		projectId,
		conversationId: selectedId,
		workspaceId,
		search: debouncedSearch,
	});

	// Render set = the polled head merged with the loaded pages, deduped by id
	// (head wins → freshest copy) and re-sorted by (updatedAt desc, id desc). New
	// or bumped conversations arrive via the head poll and slot in correctly
	// without the infinite query refetching, and without duplicate rows.
	const allConversations = useMemo(
		() =>
			mergeConversationPages([
				headQuery.data?.conversations,
				flattenPages(listQuery.data),
			]),
		[headQuery.data, listQuery.data],
	);

	const selectedConv = allConversations.find((c) => c.id === selectedId);
	const detailConv = thread.conversation ?? selectedConv ?? null;

	// Context for the "Add to knowledge" action on admin replies — only once a
	// project + workspace are resolved.
	const projectName =
		projects.data?.projects.find((p) => p.id === projectId)?.name ??
		"this agent";
	const knowledge =
		projectId && workspaceId
			? { projectId, projectName, workspaceId }
			: undefined;

	// Tags for the open conversation come from the LIST cache row (the thread
	// endpoint doesn't carry tags), so one optimistic write updates both the row
	// chips and the thread picker.
	const selectedTags = selectedConv?.tags ?? [];

	// Attach/detach EXISTING tags optimistically — same prefix-key pattern as
	// archive/delete: the chip appears/disappears across every list cache variant
	// instantly, rolls back on failure, and only the head is revalidated.
	const attachTagMut = useOptimisticMutation<{ id: string; tag: Tag }>({
		queryKey: ["conversations", projectId],
		invalidateKey: ["conversations", projectId, "head"],
		apply: (prev, vars) => addTagToConversation(prev, vars.id, vars.tag),
		mutationFn: (vars) =>
			api(`/api/projects/${projectId}/conversations/${vars.id}/tags`, {
				method: "POST",
				body: { tagId: vars.tag.id },
				workspaceId: workspaceId!,
			}),
		onError: (e) => toast.error(describeApiError(e, "Failed to add tag")),
	});

	const detachTagMut = useOptimisticMutation<{ id: string; tagId: string }>({
		queryKey: ["conversations", projectId],
		invalidateKey: ["conversations", projectId, "head"],
		apply: (prev, vars) => removeTagFromConversation(prev, vars.id, vars.tagId),
		mutationFn: (vars) =>
			api(
				`/api/projects/${projectId}/conversations/${vars.id}/tags/${vars.tagId}`,
				{ method: "DELETE", workspaceId: workspaceId! },
			),
		onError: (e) => toast.error(describeApiError(e, "Failed to remove tag")),
	});

	// Create-and-attach a NEW tag: a normal awaited mutation (the server must mint
	// the id + color first), then graft the returned tag into the cache and
	// refresh the tag list so the new tag shows in the picker/filter.
	const createTagMut = useMutation({
		mutationFn: (vars: { id: string; name: string }) =>
			api<{ tag: Tag }>(
				`/api/projects/${projectId}/conversations/${vars.id}/tags`,
				{
					method: "POST",
					body: { name: vars.name },
					workspaceId: workspaceId!,
				},
			),
		onSuccess: ({ tag }, vars) => {
			qc.setQueriesData({ queryKey: ["conversations", projectId] }, (prev) =>
				addTagToConversation(prev, vars.id, tag),
			);
			void qc.invalidateQueries({ queryKey: ["tags", workspaceId] });
			void qc.invalidateQueries({
				queryKey: ["conversations", projectId, "head"],
			});
		},
		onError: (e) => toast.error(describeApiError(e, "Failed to create tag")),
	});

	function handleToggleTag(tag: Tag) {
		if (!selectedId) return;
		const on = selectedTags.some((t) => t.id === tag.id);
		if (on) detachTagMut.mutate({ id: selectedId, tagId: tag.id });
		else attachTagMut.mutate({ id: selectedId, tag });
	}

	function handleCreateTag(name: string) {
		if (!selectedId) return;
		createTagMut.mutate({ id: selectedId, name });
	}

	function handleRemoveTag(tagId: string) {
		if (!selectedId) return;
		detachTagMut.mutate({ id: selectedId, tagId });
	}

	// ── Global tag management (admin/owner) ──────────────────────────────────
	// Rename/recolor: tag ids are stable, so after the write we just invalidate
	// the tags query (picker/filter) AND the conversations prefix (head + every
	// list variant) so the denormalized chips re-render with the new name/color.
	const patchTagMut = useMutation({
		mutationFn: (vars: { tag: Tag; name?: string; color?: string }) =>
			api<{ tag: Tag }>(`/api/tags/${vars.tag.id}`, {
				method: "PATCH",
				body: { name: vars.name, color: vars.color },
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			toast.success("Tag updated");
			void qc.invalidateQueries({ queryKey: ["tags", workspaceId] });
			void qc.invalidateQueries({ queryKey: ["conversations", projectId] });
		},
		onError: (e) =>
			toast.error(
				e instanceof ApiError && e.status === 409
					? "A tag with that name already exists."
					: describeApiError(e, "Couldn't update the tag"),
			),
	});

	// Delete: remove the tag from the tags query, strip its chips from every
	// cached conversation, and reconcile the active filter — dropping the id (which
	// changes the list/head query keys, so the list refetches on the corrected
	// filter) so no dangling filter id remains. The conversations caches are NOT
	// invalidated: the server cascade already removed the associations, the direct
	// removeTagFromAllConversations patch reflects that, and invalidating would
	// force a transient refetch on the stale (still-mounted) key — re-issuing a
	// request with the just-deleted tagId before the key change lands.
	const deleteTagMut = useMutation({
		mutationFn: (tag: Tag) =>
			api(`/api/tags/${tag.id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: (_data, tag) => {
			toast.success(`Deleted “${tag.name}”`);
			setTagIds((prev) => prev.filter((id) => id !== tag.id));
			qc.setQueryData<{ tags: Tag[] }>(["tags", workspaceId], (prev) =>
				prev ? { tags: prev.tags.filter((t) => t.id !== tag.id) } : prev,
			);
			qc.setQueriesData({ queryKey: ["conversations", projectId] }, (prev) =>
				removeTagFromAllConversations(prev, tag.id),
			);
			void qc.invalidateQueries({ queryKey: ["tags", workspaceId] });
		},
		onError: (e) => toast.error(describeApiError(e, "Couldn't delete the tag")),
	});

	const tagBusyId = patchTagMut.isPending
		? (patchTagMut.variables?.tag.id ?? null)
		: deleteTagMut.isPending
			? (deleteTagMut.variables?.id ?? null)
			: null;

	// Mark a conversation read for this user. Optimistically clears the unread dot
	// in-cache across the head + loaded pages (so a row deep in a loaded page
	// clears instantly without any refetch), then PATCHes. Best-effort: on failure
	// the next head poll restores the true unread state.
	const markRead = useCallback(
		async (id: string) => {
			if (!projectId || !workspaceId) return;
			qc.setQueriesData({ queryKey: ["conversations", projectId] }, (prev) =>
				setConversationRead(prev, id),
			);
			try {
				await api(`/api/projects/${projectId}/conversations/${id}`, {
					method: "PATCH",
					body: { read: true },
					workspaceId,
				});
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
	const loadedMessageCount = thread.messages.length;
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
			// The reply bumps updatedAt + the preview. Revalidate the HEAD only (not
			// the whole paginated list): the conversation jumps to the newest page,
			// and the render merge re-sorts it to the top from there.
			void qc.invalidateQueries({
				queryKey: ["conversations", projectId, "head"],
			});
		},
		onError: (e) => toast.error(describeApiError(e, "Failed to send reply")),
	});

	// Optimistic archive/restore + delete: the row leaves the current list the
	// instant the action fires; a failure re-inserts it (and toasts).
	const archiveMut = useOptimisticMutation<{
		id: string;
		nextArchived: boolean;
	}>({
		// Optimistically drop the row from BOTH the head and every loaded page
		// (wide key), but only revalidate the head on settle — never an all-pages
		// refetch of the infinite list.
		queryKey: ["conversations", projectId],
		invalidateKey: ["conversations", projectId, "head"],
		apply: (prev, vars) => dropConversationFromCache(prev, vars.id),
		mutationFn: (vars) =>
			api(`/api/projects/${projectId}/conversations/${vars.id}`, {
				method: "PATCH",
				body: { archived: vars.nextArchived },
				workspaceId: workspaceId!,
			}),
		onSuccess: (_data, vars) =>
			toast.success(
				vars.nextArchived ? "Conversation resolved" : "Conversation reopened",
			),
		onError: (e) =>
			toast.error(describeApiError(e, "Failed to update conversation")),
	});

	// Delete is NON-optimistic + confirm: the conversation row must not vanish
	// before the server acknowledges a permanent, irreversible delete (unlike
	// Resolve above, which is reversible so optimism is correct). The confirm
	// dialog stays open showing "Deleting…" until onSuccess, which then closes the
	// pane and reconciles the list — so a failed delete surfaces, never reads as
	// success.
	const deleteMut = useMutation({
		mutationFn: (id: string) =>
			api(`/api/projects/${projectId}/conversations/${id}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			toast.success("Conversation deleted");
			setSelectedId(null);
			setDetailsOpen(false);
			void qc.invalidateQueries({ queryKey: ["conversations", projectId] });
		},
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

	function handleResolve() {
		if (!projectId || !detailConv || !workspaceId) return;
		const { id } = detailConv;
		const nextArchived = !detailConv.archivedAt;
		// Resolve is optimistic + reversible: close the pane alongside the row
		// removal (Reopen restores it).
		setSelectedId(null);
		setDetailsOpen(false);
		archiveMut.mutate({ id, nextArchived });
	}

	function handleDelete() {
		if (!projectId || !detailConv || !workspaceId) return;
		// Non-optimistic: fire and let the confirm dialog show pending; the pane
		// closes on success (see deleteMut), never before the server confirms.
		deleteMut.mutate(detailConv.id);
	}

	// Loading, or redirecting a brand-new account to onboarding.
	if (onboardingState !== "ready") {
		return <InboxSkeleton />;
	}

	const threadSubtitle =
		[
			detailConv && `Started ${timeAgo(detailConv.createdAt)}`,
			detailConv?.email,
			parseDevice(detailConv?.userAgent),
		]
			.filter(Boolean)
			.join(" · ") ||
		(detailConv ? pluralize(detailConv.messageCount, "message") : "");

	// A conversation is open. Drives one-pane-at-a-time on mobile: while open, the
	// list-scoped header/toolbar give way to the full-screen thread.
	const threadOpen = Boolean(selectedId && detailConv);

	// h-full fills the shell's bounded main (below the top bar + any launch
	// banner) — see dashboard-shell. The shell owns the chrome height now, so the
	// inbox no longer hard-codes a viewport calc.
	return (
		<div className="flex h-full flex-col">
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
						<ListFilters
							total={statsQuery.data?.total}
							search={search}
							onSearch={setSearch}
							status={status}
							onStatusChange={(next) => {
								setStatus(next);
								setSelectedId(null);
							}}
							tags={allTags}
							tagIds={tagIds}
							onTagIdsChange={setTagIds}
							onManageTags={
								canManage ? () => setManageTagsOpen(true) : undefined
							}
						/>
						{listQuery.isLoading ? (
							<ConversationListSkeleton />
						) : (
							<>
								<ConversationList
									conversations={allConversations}
									selectedId={selectedId}
									onSelect={handleSelect}
									search={debouncedSearch}
									status={status}
								/>
								{listQuery.hasNextPage && (
									<LoadMore
										onLoadMore={() => void listQuery.fetchNextPage()}
										loading={listQuery.isFetchingNextPage}
									/>
								)}
							</>
						)}
					</>
				}
				threadHeader={
					detailConv && (
						<>
							<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ck-accent text-xs font-bold text-white">
								{initials(detailConv.name)}
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<p className="truncate text-sm font-bold text-ck-text">
										{detailConv.name ?? "Anonymous"}
									</p>
									<span
										className={cn(
											"inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
											STATUS_PILL[deriveStatus(detailConv)].className,
										)}
									>
										{STATUS_PILL[deriveStatus(detailConv)].label}
									</span>
								</div>
								{detailConv.summary && (
									<p className="truncate text-xs text-ck-muted">
										{detailConv.summary}
									</p>
								)}
								<p className="truncate text-xs text-ck-faint">
									{threadSubtitle}
								</p>
							</div>
						</>
					)
				}
				threadActions={
					detailConv && (
						<ThreadActions
							resolved={Boolean(detailConv.archivedAt)}
							onResolve={handleResolve}
							onDelete={handleDelete}
							resolving={archiveMut.isPending}
							deleting={deleteMut.isPending}
						/>
					)
				}
				threadBody={
					detailConv &&
					(thread.isLoading && thread.messages.length === 0 ? (
						<div className="flex flex-1 items-center justify-center text-sm text-ck-faint">
							Loading…
						</div>
					) : (
						<MessageThread
							messages={thread.messages}
							search={debouncedSearch}
							hasOlder={thread.hasOlder}
							onLoadOlder={thread.loadOlder}
							loadingOlder={thread.loadingOlder}
							knowledge={knowledge}
						/>
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
							tags={allTags}
							attachedTags={selectedTags}
							onToggleTag={handleToggleTag}
							onCreateTag={handleCreateTag}
							onRemoveTag={handleRemoveTag}
							creatingTag={createTagMut.isPending}
						/>
					) : null
				}
				emptyState={
					<div className="flex flex-1 items-center justify-center text-sm text-ck-faint">
						Select a conversation
					</div>
				}
				detailsEmptyState={
					<div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-ck-faint">
						<p className="text-xs">
							Select a conversation to see visitor details
						</p>
					</div>
				}
			/>

			{canManage && (
				<ManageTagsDialog
					open={manageTagsOpen}
					onOpenChange={setManageTagsOpen}
					tags={allTags}
					busyId={tagBusyId}
					onRename={(tag, name) => patchTagMut.mutate({ tag, name })}
					onRecolor={(tag, color) => patchTagMut.mutate({ tag, color })}
					onDelete={(tag) => deleteTagMut.mutate(tag)}
				/>
			)}
		</div>
	);
}
