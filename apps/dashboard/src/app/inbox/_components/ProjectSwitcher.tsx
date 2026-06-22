"use client";

import { ChevronDown } from "lucide-react";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ds";

export interface ProjectOption {
	id: string;
	name: string;
}

/**
 * The inbox's OWN project filter — workspace-scoped, independent of the top-bar
 * project switcher (locked decision: it does not read the shell selection). It's
 * framed as a "Project:" FILTER (not a context switcher) so the two don't read
 * as duplicates. Per-project today; a true "All projects" option lands with the
 * workspace-wide inbox (its own endpoint), so it's deliberately absent here
 * rather than shipped non-functional.
 */
export function ProjectSwitcher({
	projects,
	value,
	onChange,
}: {
	projects: ProjectOption[];
	value: string | null;
	onChange: (id: string) => void;
}) {
	const current = projects.find((p) => p.id === value);
	return (
		<div className="border-b border-ck-border p-3">
			<Menu>
				<MenuTrigger asChild>
					<button
						aria-label="Filter by project"
						className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-ck-border bg-ck-card px-3 text-sm text-ck-text outline-none hover:border-ck-accent focus-visible:border-ck-accent"
					>
						<span className="text-[11px] font-semibold uppercase tracking-wide text-ck-faint">
							Project
						</span>
						<span className="min-w-0 flex-1 truncate text-left font-medium">
							{current?.name ?? "Select a project"}
						</span>
						<ChevronDown className="size-4 shrink-0 text-ck-faint" />
					</button>
				</MenuTrigger>
				<MenuContent
					align="start"
					className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
				>
					{projects.map((p) => (
						<MenuItem
							key={p.id}
							selected={p.id === value}
							onSelect={() => onChange(p.id)}
						>
							<span className="truncate">{p.name}</span>
						</MenuItem>
					))}
				</MenuContent>
			</Menu>
		</div>
	);
}
