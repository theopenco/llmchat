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
	type WorkspaceRole,
	type WorkspaceSummary,
	type WorkspacesResponse,
	WORKSPACES_KEY,
} from "./workspace-utils";

interface WorkspaceCtx {
	workspaces: WorkspaceSummary[];
	workspaceId: string | null;
	setWorkspaceId: (id: string) => void;
	isLoading: boolean;
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
	role: null,
	canManage: false,
});

const KEY = "llmchat_workspace_id";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
	const [workspaceId, set] = useState<string | null>(null);

	const query = useQuery({
		queryKey: WORKSPACES_KEY,
		queryFn: () => api<WorkspacesResponse>("/api/workspaces"),
		retry: false,
	});

	// Stable reference: keep the effect and every consumer from re-running on
	// each render just because `.map()` produced a fresh array.
	const { data, isLoading } = query;
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
		// Reconcile the persisted choice against the workspaces the user can
		// actually see; see resolveWorkspaceId for the stale-selection rules.
		const next = resolveWorkspaceId(localStorage.getItem(KEY), workspaces);
		if (next === workspaceId) return;
		if (next === null) {
			localStorage.removeItem(KEY);
		} else {
			localStorage.setItem(KEY, next);
		}
		set(next);
	}, [isLoading, data, workspaces, workspaceId]);

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
			role,
			canManage: canManage(role),
		}),
		[workspaces, workspaceId, setWorkspaceId, isLoading, role],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
	return useContext(Ctx);
}
