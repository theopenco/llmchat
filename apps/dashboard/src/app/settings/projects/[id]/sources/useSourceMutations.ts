"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { api, describeApiError } from "@/lib/api";
import { dropById, useOptimisticMutation } from "@/lib/optimistic";

import type { Source } from "../types";

/**
 * Source add / refresh / delete for the standalone Sources page — extracted from
 * useProjectMutations so the Sources page owns them (single source of truth) and
 * the config page no longer carries source writes. Delete stays one-click
 * optimistic on purpose: a source is re-addable and a failed delete self-heals
 * on the next refetch — not the irreversible-record case the confirm+
 * non-optimistic pattern (#68/#70) exists for.
 */
export function useSourceMutations(id: string, workspaceId: string | null) {
	const qc = useQueryClient();

	const addSource = useMutation({
		mutationFn: (url: string) =>
			api<{ source: Source }>(`/api/projects/${id}/sources`, {
				method: "POST",
				body: { url },
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source added");
			track(ANALYTICS_EVENTS.sourceAdded, { kind: "url" });
		},
		onError: (e) => toast.error(describeApiError(e, "Could not add source")),
	});

	// Manual text snippet — hits the dedicated /sources/text create route.
	const addText = useMutation({
		mutationFn: (input: { title?: string; content: string }) =>
			api<{ source: Source }>(`/api/projects/${id}/sources/text`, {
				method: "POST",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source added");
			track(ANALYTICS_EVENTS.sourceAdded, { kind: "text" });
		},
		onError: (e) => toast.error(describeApiError(e, "Could not add source")),
	});

	// Hand-written Q&A pair — /sources/qa (sibling of promote-a-reply, no
	// message provenance).
	const addQa = useMutation({
		mutationFn: (input: { question: string; answer: string }) =>
			api<{ source: Source }>(`/api/projects/${id}/sources/qa`, {
				method: "POST",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source added");
			track(ANALYTICS_EVENTS.sourceAdded, { kind: "qa" });
		},
		onError: (e) => toast.error(describeApiError(e, "Could not add source")),
	});

	const refreshSource = useMutation({
		mutationFn: (sourceId: string) =>
			api(`/api/projects/${id}/sources/${sourceId}/refresh`, {
				method: "POST",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source refreshed");
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Could not refresh source")),
	});

	const deleteSource = useOptimisticMutation<string>({
		queryKey: ["sources", id],
		apply: (prev, sourceId) => dropById(prev, "sources", sourceId),
		mutationFn: (sourceId) =>
			api(`/api/projects/${id}/sources/${sourceId}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => toast.success("Source removed"),
		onError: (e) => toast.error(describeApiError(e, "Could not remove source")),
	});

	return { addSource, addText, addQa, refreshSource, deleteSource };
}
