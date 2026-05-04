"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface WorkspaceCtx {
	workspaceId: string | null;
	setWorkspaceId: (id: string) => void;
}

const Ctx = createContext<WorkspaceCtx>({
	workspaceId: null,
	setWorkspaceId: () => {},
});

const KEY = "llmchat_workspace_id";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
	const [workspaceId, set] = useState<string | null>(null);

	useEffect(() => {
		const stored = localStorage.getItem(KEY);
		if (stored) {
			set(stored);
		}
	}, []);

	function setWorkspaceId(id: string) {
		localStorage.setItem(KEY, id);
		set(id);
	}

	return (
		<Ctx.Provider value={{ workspaceId, setWorkspaceId }}>
			{children}
		</Ctx.Provider>
	);
}

export function useWorkspace() {
	return useContext(Ctx);
}
