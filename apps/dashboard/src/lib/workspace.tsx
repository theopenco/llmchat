"use client";

import { useQuery } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { api } from "./api";
import {
	canManage,
	resolveWorkspaceId,
	shouldDeferDemotion,
	type WorkspaceRole,
	type WorkspaceSummary,
	type WorkspacesResponse,
	WORKSPACE_STORAGE_KEY as KEY,
	WORKSPACES_KEY,
} from "./workspace-utils";

interface WorkspaceCtx {
	workspaces: WorkspaceSummary[];
	workspaceId: string | null;
	setWorkspaceId: (id: string) => void;
	isLoading: boolean;
	/** True once the workspace list has actually been FETCHED. An empty
	 * `workspaces` is only meaningful ("this user has none") when this is true —
	 * a failed fetch also yields [] and must not be read as brand-new-user. */
	loaded: boolean;
	/** The current user's role in the active workspace (null until resolved). */
	role: WorkspaceRole | null;
	/** Whether the active role may manage the workspace (create/edit/delete
	 * projects, sources, prompts). Drives RoleGate and button enablement. */
	canManage: boolean;
}

const Ctx = createContext<WorkspaceCtx>({
	workspaces: [],
	workspaceId: null,
	setWorkspaceId: () => {},
	isLoading: false,
	loaded: false,
	role: null,
	canManage: false,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
	const [workspaceId, set] = useState<string | null>(null);

	const query = useQuery({
		queryKey: WORKSPACES_KEY,
		queryFn: () => api<WorkspacesResponse>("/api/workspaces"),
		retry: false,
	});

	// Stable reference: keep the effect and every consumer from re-running on
	// each render just because `.map()` produced a fresh array.
	const { data, isLoading, isFetching, isSuccess } = query;
	const workspaces = useMemo(
		() =>
			data?.workspaces.map((w) => ({
				...w.workspace,
				role: w.role,
				projectCount: w.projectCount,
			})) ?? [],
		[data],
	);

	useEffect(() => {
		if (isLoading || !data) return;
		const stored = localStorage.getItem(KEY);
		// A stored id missing from the list may just mean the LIST is stale — a
		// refetch is in flight (invite accept invalidates it right before
		// selecting the joined workspace). Hold the demotion until fresh data
		// lands; the effect re-runs when it does. See shouldDeferDemotion.
		if (shouldDeferDemotion(stored, workspaces, isFetching)) return;
		// Reconcile the persisted choice against the workspaces the user can
		// actually see; see resolveWorkspaceId for the stale-selection rules.
		const next = resolveWorkspaceId(stored, workspaces);
		if (next === workspaceId) return;
		if (next === null) {
			localStorage.removeItem(KEY);
		} else {
			localStorage.setItem(KEY, next);
		}
		set(next);
	}, [isLoading, isFetching, data, workspaces, workspaceId]);

	// Persist + activate a workspace id. If the id may not be in the CACHED
	// workspace list yet (just joined via invite, just created), the caller
	// must first make it resolvable — patch the list cache (invite accept) or
	// await the invalidation refetch (CreateWorkspaceDialog) — or the
	// reconcile effect will demote the selection once fetching settles.
	const setWorkspaceId = useCallback((id: string) => {
		localStorage.setItem(KEY, id);
		set(id);
	}, []);

	const role = workspaces.find((w) => w.id === workspaceId)?.role ?? null;

	const value = useMemo<WorkspaceCtx>(
		() => ({
			workspaces,
			workspaceId,
			setWorkspaceId,
			isLoading,
			loaded: isSuccess,
			role,
			canManage: canManage(role),
		}),
		[workspaces, workspaceId, setWorkspaceId, isLoading, isSuccess, role],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
	return useContext(Ctx);
}
