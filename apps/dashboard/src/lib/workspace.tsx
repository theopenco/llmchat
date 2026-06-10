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

interface WorkspaceSummary {
	id: string;
	name: string;
}

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
		queryKey: ["workspaces"],
		queryFn: () =>
			api<{ workspaces: { workspace: WorkspaceSummary }[] }>("/api/workspaces"),
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
		if (isLoading || !data) {
			return;
		}
		if (workspaces.length === 0) {
			if (workspaceId) {
				localStorage.removeItem(KEY);
				set(null);
			}
			return;
		}
		// Honor a stored selection only if it's still one of the user's workspaces;
		// otherwise fall back to the first one so a stale localStorage value can't
		// pin the UI to a workspace that no longer exists.
		const stored = localStorage.getItem(KEY);
		const next =
			stored && workspaces.some((w) => w.id === stored)
				? stored
				: workspaces[0]!.id;
		if (next !== workspaceId) {
			localStorage.setItem(KEY, next);
			set(next);
		}
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
