"use client";

import {
	FolderKanban,
	Globe,
	MessagesSquare,
	SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavItem } from "@/components/ds";
import { UsageMeter } from "@/components/shell/usage-meter";
import { useSelectedProject } from "@/lib/use-selected-project";

function GroupLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="px-2.5 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ck-faint">
			{children}
		</div>
	);
}

/**
 * Grouped sidebar nav: WORKSPACE {Conversations, Projects} · PROJECT {Sources,
 * Settings}. No Analytics (removed, not stubbed), no Billing (it's in the account
 * menu + usage meter). The PROJECT group is hidden until a project exists.
 *
 * Interim routing (locked): the project-scoped Sources/Settings pages don't exist
 * yet (#92/#93), so both point at the selected project's existing config surface —
 * Settings to the page, Sources to its real `#sources` section. Repoint when the
 * decomposed pages land.
 *
 * Conversations has no unread badge: there's no workspace-level unread aggregate
 * endpoint to feed one honestly (the API only exposes per-conversation unread
 * flags). The NavItem keeps a trailing slot for when such an endpoint exists.
 */
export function SidebarNav() {
	const pathname = usePathname();
	const { selectedProjectId } = useSelectedProject();

	const projectBase = selectedProjectId
		? `/settings/projects/${selectedProjectId}`
		: null;
	const onProject = projectBase ? pathname === projectBase : false;

	return (
		<div className="flex h-full flex-col p-2.5">
			<nav className="flex-1">
				<GroupLabel>Workspace</GroupLabel>
				<NavItem
					asChild
					icon={<MessagesSquare />}
					label="Conversations"
					active={pathname === "/inbox" || pathname.startsWith("/inbox/")}
				>
					<Link href="/inbox" />
				</NavItem>
				<NavItem
					asChild
					icon={<FolderKanban />}
					label="Projects"
					active={pathname === "/settings/projects"}
				>
					<Link href="/settings/projects" />
				</NavItem>

				{projectBase && (
					<>
						<GroupLabel>Project</GroupLabel>
						<NavItem asChild icon={<Globe />} label="Sources">
							<Link href={`${projectBase}#sources`} />
						</NavItem>
						<NavItem
							asChild
							icon={<SlidersHorizontal />}
							label="Settings"
							active={onProject}
						>
							<Link href={projectBase} />
						</NavItem>
					</>
				)}
			</nav>

			<UsageMeter />
		</div>
	);
}
