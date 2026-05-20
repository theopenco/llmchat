"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

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
			api<{ workspaces: { workspace: WorkspaceSummary }[] }>(
				"/api/workspaces",
			),
		retry: false,
	});

	const workspaces = query.data?.workspaces.map((w) => w.workspace) ?? [];

	useEffect(() => {
		if (query.isLoading || !query.data) {
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
	}, [query.isLoading, query.data, workspaces, workspaceId]);

	function setWorkspaceId(id: string) {
		localStorage.setItem(KEY, id);
		set(id);
	}

	return (
		<Ctx.Provider
			value={{
				workspaces,
				workspaceId,
				setWorkspaceId,
				isLoading: query.isLoading,
			}}
		>
			{children}
		</Ctx.Provider>
	);
}

export function useWorkspace() {
	return useContext(Ctx);
}
