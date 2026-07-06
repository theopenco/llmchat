"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { api, describeApiError } from "@/lib/api";
import { mapById, useOptimisticMutation } from "@/lib/optimistic";

import type { Project } from "./types";

/** All write operations for the project settings page, with cache
 * invalidation and toasts in one place. */
export function useProjectMutations(id: string, workspaceId: string | null) {
	const qc = useQueryClient();
	const router = useRouter();

	// Optimistic save: merge the edited fields into the cached project so the
	// detail page (which reads this list via `select`) and the projects grid both
	// reflect the change — and clear the dirty state — instantly; a failure rolls
	// back. Settle invalidates to reconcile with the server's truth.
	const save = useOptimisticMutation<Partial<Project>>({
		queryKey: ["projects", workspaceId],
		apply: (prev, input) =>
			mapById<Project>(prev, "projects", id, (p) => ({ ...p, ...input })),
		mutationFn: (input) =>
			api(`/api/projects/${id}`, {
				method: "PATCH",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: (_data, input) => {
			toast.success("Project updated successfully");
			track(ANALYTICS_EVENTS.projectSettingsSaved, {
				fields: Object.keys(input).sort().join(","),
			});
			// Field-specific events answer their own questions (which models do
			// operators pick? is the prompt/knowledge base actually edited?) — a
			// save touching several fields legitimately fires more than one.
			if (input.model !== undefined)
				track(ANALYTICS_EVENTS.modelChanged, { model: input.model });
			if (input.systemPrompt !== undefined)
				track(ANALYTICS_EVENTS.systemPromptSaved);
			if (input.knowledgeText !== undefined)
				track(ANALYTICS_EVENTS.knowledgeBaseUpdated);
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

	// Source add/refresh/delete moved to the standalone Sources page's
	// useSourceMutations (single owner of source writes; see #92).
	return { save, remove };
}
