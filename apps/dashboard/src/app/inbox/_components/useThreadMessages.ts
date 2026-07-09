"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

import {
	appendNewer,
	maxSequence,
	minSequence,
	prependOlder,
	threadParams,
	toWindow,
	type ThreadResponse,
	type ThreadWindow,
} from "./thread-window";

const POLL_MS = 3_000;

/**
 * Windowed message thread for the open conversation. The window is held in the
 * `["thread", projectId, conversationId]` react-query cache (so the Phase-1
 * optimistic reply keeps appending to it and its onSettled invalidate still
 * reconciles temp→real). On top of that single query this hook adds:
 *
 * - latest-page-first load (server returns the newest THREAD_PAGE_SIZE), so a
 *   thread at/under the threshold loads whole and behaves exactly as before;
 * - a 3s poll that fetches NEWEST-ONLY (`after=maxSeq`) and appends — never a
 *   refetch of loaded pages;
 * - `loadOlder()` that prepends the page above (`before=minSeq`);
 * - search: the latest fetch reports `firstHitSequence`, and the hook auto-loads
 *   older pages until that hit is in the window, so scroll-to-hit can fire.
 */
export function useThreadMessages({
	projectId,
	conversationId,
	workspaceId,
	search,
}: {
	projectId: string | null;
	conversationId: string | null;
	workspaceId: string | null;
	search: string;
}) {
	const qc = useQueryClient();
	const enabled = !!projectId && !!conversationId && !!workspaceId;
	// Stable key (no search) so the Phase-1 reply mutation — which targets
	// ["thread", projectId, conversationId] — still hits the active query.
	const key = ["thread", projectId, conversationId] as const;

	// `search` is read by the queryFn via a ref so it doesn't churn the key; a
	// debounced-search change invalidates the query (effect below) to refetch.
	const searchRef = useRef(search);
	searchRef.current = search;

	const query = useQuery({
		queryKey: key,
		enabled,
		// Polling is handled by the effect below (newest-only); the base query must
		// not refetch the whole window on an interval.
		refetchInterval: false,
		queryFn: () =>
			api<ThreadResponse>(
				`/api/projects/${projectId}/conversations/${conversationId}?${threadParams(
					{ search: searchRef.current.trim() || undefined },
				)}`,
				{ workspaceId: workspaceId! },
			).then(toWindow),
	});

	// A debounced-search change refetches the latest page WITH the term, so
	// firstHitSequence updates (and the auto-load-to-hit effect can run).
	useEffect(() => {
		if (enabled) void qc.invalidateQueries({ queryKey: key });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search]);

	// 3s poll: newest-only. Reads the live window from cache each tick, fetches
	// after the max loaded sequence, and appends — loaded pages are never
	// refetched. Also refreshes the conversation (status/csat).
	useEffect(() => {
		if (!enabled) return;
		let inFlight = false;
		const tick = async () => {
			if (inFlight) return;
			const cur = qc.getQueryData<ThreadWindow>(key);
			if (!cur) return;
			inFlight = true;
			try {
				const res = await api<ThreadResponse>(
					`/api/projects/${projectId}/conversations/${conversationId}?${threadParams(
						{ after: maxSequence(cur.messages) ?? 0 },
					)}`,
					{ workspaceId: workspaceId! },
				);
				qc.setQueryData<ThreadWindow>(key, (old) => appendNewer(old, res));
			} catch {
				/* transient — next tick retries */
			} finally {
				inFlight = false;
			}
		};
		const handle = setInterval(tick, POLL_MS);
		return () => clearInterval(handle);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, projectId, conversationId, workspaceId]);

	const [loadingOlder, setLoadingOlder] = useState(false);
	const loadingOlderRef = useRef(false);

	const loadOlder = useCallback(async () => {
		const cur = qc.getQueryData<ThreadWindow>(key);
		if (!cur || !cur.hasOlder || loadingOlderRef.current) return;
		loadingOlderRef.current = true;
		setLoadingOlder(true);
		try {
			const res = await api<ThreadResponse>(
				`/api/projects/${projectId}/conversations/${conversationId}?${threadParams(
					{ before: minSequence(cur.messages) ?? 0 },
				)}`,
				{ workspaceId: workspaceId! },
			);
			qc.setQueryData<ThreadWindow>(key, (old) => prependOlder(old, res));
		} catch {
			/* leave the affordance so the user can retry */
		} finally {
			loadingOlderRef.current = false;
			setLoadingOlder(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [qc, projectId, conversationId, workspaceId]);

	// Search auto-load: keep loading older pages until the first hit is inside the
	// window, so scroll-to-first-hit (in MessageThread) has the message to scroll
	// to. Terminates when the hit is reached or there's no more history.
	const data = query.data;
	useEffect(() => {
		if (!data || data.firstHitSequence == null) return;
		const min = minSequence(data.messages);
		if (
			min !== null &&
			data.firstHitSequence < min &&
			data.hasOlder &&
			!loadingOlder
		) {
			void loadOlder();
		}
	}, [data, loadingOlder, loadOlder]);

	return {
		conversation: data?.conversation ?? null,
		messages: data?.messages ?? [],
		agentActions: data?.agentActions ?? [],
		hasOlder: data?.hasOlder ?? false,
		loadOlder,
		loadingOlder,
		isLoading: query.isLoading,
	};
}
