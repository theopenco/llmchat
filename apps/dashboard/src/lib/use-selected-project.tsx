"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { api } from "./api";
import { resolveSelectedId } from "./selection";
import { useWorkspace } from "./workspace";

export interface ShellProject {
	id: string;
	name: string;
	brandColor: string;
}

interface SelectedProjectCtx {
	projects: ShellProject[];
	selectedProjectId: string | null;
	selectedProject: ShellProject | null;
	setSelectedProjectId: (id: string) => void;
}

const Ctx = createContext<SelectedProjectCtx>({
	projects: [],
	selectedProjectId: null,
	selectedProject: null,
	setSelectedProjectId: () => {},
});

/** Per-workspace persistence so each workspace remembers its own last project. */
const keyFor = (workspaceId: string) =>
	`clanker:selected-project:${workspaceId}`;

/**
 * Lightweight, nav-only selected-project state for the shell (locked decision):
 * it holds which project the top-bar switcher points at — its label + the target
 * for the PROJECT nav items — and NOTHING else. Data scoping still comes from the
 * route `[id]`; this is not a global data context. The inbox keeps its own,
 * separate project filter and does not read this.
 *
 * Seeding rules (mirrors the workspace selection pattern):
 *  - on a `/settings/projects/[id]` route, that `[id]` is authoritative (and is
 *    persisted), so the URL and the switcher never disagree;
 *  - otherwise the persisted choice is honored, falling back to the first project
 *    (resolveSelectedId) so a deleted/foreign id can't pin the UI.
 */
export function SelectedProjectProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { workspaceId } = useWorkspace();
	const pathname = usePathname();
	const [selectedProjectId, set] = useState<string | null>(null);

	const projectsQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ShellProject[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});
	const data = projectsQ.data;
	const projects = useMemo(() => data?.projects ?? [], [data]);

	// The project id encoded in the current route, if any.
	// Match the project id on the project route AND its nested sub-routes
	// (/sources, and later /settings/*), so the URL stays authoritative as the
	// config page decomposes into project-scoped pages — the PROJECT nav group
	// resolves the right project on every one of them.
	const urlProjectId =
		pathname.match(/^\/settings\/projects\/([^/]+)(?:\/|$)/)?.[1] ?? null;

	useEffect(() => {
		if (!workspaceId || !data) return;
		const stored = localStorage.getItem(keyFor(workspaceId));
		// URL wins when it names a project that exists in this workspace.
		const fromUrl =
			urlProjectId && projects.some((p) => p.id === urlProjectId)
				? urlProjectId
				: null;
		const next = fromUrl ?? resolveSelectedId(stored, projects);
		if (next === selectedProjectId) return;
		if (next === null) localStorage.removeItem(keyFor(workspaceId));
		else localStorage.setItem(keyFor(workspaceId), next);
		set(next);
	}, [workspaceId, data, projects, urlProjectId, selectedProjectId]);

	const setSelectedProjectId = useCallback(
		(id: string) => {
			if (workspaceId) localStorage.setItem(keyFor(workspaceId), id);
			set(id);
		},
		[workspaceId],
	);

	const selectedProject =
		projects.find((p) => p.id === selectedProjectId) ?? null;

	const value = useMemo<SelectedProjectCtx>(
		() => ({
			projects,
			selectedProjectId,
			selectedProject,
			setSelectedProjectId,
		}),
		[projects, selectedProjectId, selectedProject, setSelectedProjectId],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedProject() {
	return useContext(Ctx);
}
