"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
	Button,
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "@/components/ds";
import { RoleGate } from "@/components/role-gate";
import { useSelectedProject } from "@/lib/use-selected-project";

const DOT = (color: string) => (
	<span
		className="size-2 shrink-0 rounded-full"
		style={{ backgroundColor: color || "#6366f1" }}
	/>
);

/**
 * Top-bar project switcher. Nav-only (locked decision): picking a project sets
 * the lightweight shell selection AND navigates to that project's surface, where
 * the route `[id]` becomes authoritative. Hidden entirely when the workspace has
 * no projects yet (no dead control — those users are in onboarding). Does not
 * touch the inbox, which keeps its own project filter.
 */
export function ProjectSwitcher() {
	const router = useRouter();
	const { projects, selectedProjectId, selectedProject, setSelectedProjectId } =
		useSelectedProject();

	if (projects.length === 0) return null;

	function pick(id: string) {
		setSelectedProjectId(id);
		router.push(`/settings/projects/${id}`);
	}

	return (
		<Menu>
			<MenuTrigger asChild>
				<Button variant="pill" size="pill" aria-label="Switch project">
					{DOT(selectedProject?.brandColor ?? "")}
					<span className="max-w-40 truncate">
						{selectedProject?.name ?? "Project"}
					</span>
					<ChevronDown className="size-3 text-ck-faint" />
				</Button>
			</MenuTrigger>
			<MenuContent align="start">
				<MenuLabel>Projects</MenuLabel>
				{projects.map((p) => (
					<MenuItem
						key={p.id}
						selected={p.id === selectedProjectId}
						onSelect={() => pick(p.id)}
					>
						{DOT(p.brandColor)}
						<span className="truncate">{p.name}</span>
					</MenuItem>
				))}
				<RoleGate>
					<MenuSeparator />
					<MenuItem onSelect={() => router.push("/onboarding?new=1")}>
						<Plus />
						New project
					</MenuItem>
				</RoleGate>
			</MenuContent>
		</Menu>
	);
}
