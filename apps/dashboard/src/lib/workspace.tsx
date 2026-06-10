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
	resolveWorkspaceId,
	type WorkspaceSummary,
	type WorkspacesResponse,
	WORKSPACES_KEY,
} from "./workspace-utils";

interface WorkspaceCtx {
	workspaces: WorkspaceSummary[];
	workspaceId: string | null;
	setWorkspaceId: (id: string) => void;
	isLoading: boolean;
}

const Ctx = createContext<WorkspaceCtx>({
	workspaces: [],
	workspaceId: null,
	setWorkspaceId: () => {},
	isLoading: false,
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
		() => data?.workspaces.map((w) => w.workspace) ?? [],
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

	const value = useMemo<WorkspaceCtx>(
		() => ({ workspaces, workspaceId, setWorkspaceId, isLoading }),
		[workspaces, workspaceId, setWorkspaceId, isLoading],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
	return useContext(Ctx);
}
