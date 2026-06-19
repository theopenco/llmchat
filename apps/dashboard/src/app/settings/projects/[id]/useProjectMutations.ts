"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api, describeApiError } from "@/lib/api";

import type { Project, Source } from "./types";

/** All write operations for the project settings page, with cache
 * invalidation and toasts in one place. */
export function useProjectMutations(id: string, workspaceId: string | null) {
	const qc = useQueryClient();
	const router = useRouter();

	const save = useMutation({
		mutationFn: (input: Partial<Project>) =>
			api(`/api/projects/${id}`, {
				method: "PATCH",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			toast.success("Project updated successfully");
		},
		onError: (e) => toast.error(describeApiError(e, "Could not save project")),
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
			toast.error(describeApiError(e, "Could not delete project")),
	});

	const addSource = useMutation({
		mutationFn: (url: string) =>
			api<{ source: Source }>(`/api/projects/${id}/sources`, {
				method: "POST",
				body: { url },
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source added successfully");
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

	const deleteSource = useMutation({
		mutationFn: (sourceId: string) =>
			api(`/api/projects/${id}/sources/${sourceId}`, {
				method: "DELETE",
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["sources", id] });
			toast.success("Source removed");
		},
		onError: (e) => toast.error(describeApiError(e, "Could not remove source")),
	});

	return { save, remove, addSource, refreshSource, deleteSource };
}
