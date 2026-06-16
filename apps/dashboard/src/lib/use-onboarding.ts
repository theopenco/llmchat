"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { resolveOnboardingState, type OnboardingState } from "@/lib/onboarding";
import { useWorkspace } from "@/lib/workspace";

interface ProjectLite {
	id: string;
}

/**
 * Resolves whether the current user still needs onboarding (no workspace or no
 * project) vs. is ready for the dashboard. Backs both the onboarding page guard
 * and the inbox redirect, so they always agree.
 */
export function useOnboardingState(): {
	state: OnboardingState;
	workspaceId: string | null;
} {
	const { workspaceId, isLoading: wsLoading } = useWorkspace();
	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ProjectLite[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	const loading = wsLoading || (!!workspaceId && projects.isLoading);
	const state = resolveOnboardingState({
		loading,
		hasWorkspace: !!workspaceId,
		projectCount: projects.data?.projects.length ?? 0,
	});
	return { state, workspaceId };
}
