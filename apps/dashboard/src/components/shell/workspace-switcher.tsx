"use client";

import { ChevronDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CreateWorkspaceDialog } from "@/app/settings/workspaces/_components/CreateWorkspaceDialog";
import {
	Button,
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "@/components/ds";
import { useWorkspace } from "@/lib/workspace";

/**
 * Top-bar workspace switcher: switch between the user's workspaces, plus create
 * and manage (reusing the workspace-management surfaces from #64). Selection runs
 * through the existing useWorkspace context — this is presentation only.
 */
export function WorkspaceSwitcher() {
	const { workspaces, workspaceId, setWorkspaceId } = useWorkspace();
	const [createOpen, setCreateOpen] = useState(false);
	const current = workspaces.find((w) => w.id === workspaceId);

	return (
		<>
			<Menu>
				<MenuTrigger asChild>
					<Button variant="pill" size="pill" aria-label="Switch workspace">
						<span className="size-1.5 rounded-full bg-ck-accent" />
						<span className="max-w-40 truncate">
							{current?.name ?? "Workspace"}
						</span>
						<ChevronDown className="size-3 text-ck-faint" />
					</Button>
				</MenuTrigger>
				<MenuContent align="start">
					<MenuLabel>Workspaces</MenuLabel>
					{workspaces.map((w) => (
						<MenuItem
							key={w.id}
							selected={w.id === workspaceId}
							onSelect={() => setWorkspaceId(w.id)}
						>
							<span className="truncate">{w.name}</span>
						</MenuItem>
					))}
					<MenuSeparator />
					<MenuItem onSelect={() => setCreateOpen(true)}>
						<Plus />
						Create workspace
					</MenuItem>
					<MenuItem asChild>
						<Link href="/settings/workspaces">
							<Settings2 />
							Manage workspaces
						</Link>
					</MenuItem>
				</MenuContent>
			</Menu>

			<CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
		</>
	);
}
