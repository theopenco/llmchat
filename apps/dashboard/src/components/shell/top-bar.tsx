"use client";

import {
	ChevronRight,
	HelpCircle,
	Menu as MenuIcon,
	Search,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ds";
import { AccountMenu } from "@/components/shell/account-menu";
import { ProjectSwitcher } from "@/components/shell/project-switcher";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";

/**
 * The Command Bar: logo · workspace ▸ project switchers · ⌘K search · Help ·
 * account menu. Height is h-12 (mobile) / h-14 (desktop) on purpose — the inbox
 * sizes itself to match, keeping it full-height without touching the page. The
 * search affordance opens the ⌘K command palette (shell-owned); on mobile it
 * collapses to an icon button.
 */
export function TopBar({
	userEmail,
	roleLabel,
	onOpenSidebar,
	onOpenSearch,
}: {
	userEmail: string;
	roleLabel: string;
	onOpenSidebar: () => void;
	onOpenSearch: () => void;
}) {
	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b border-ck-border bg-ck-topbar px-3 md:h-14 md:px-4">
			<Button
				variant="ghost"
				size="icon"
				className="md:hidden"
				aria-label="Open navigation"
				onClick={onOpenSidebar}
			>
				<MenuIcon className="size-5" />
			</Button>

			<BrandLogo className="size-7 shrink-0" />

			<WorkspaceSwitcher />
			<ChevronRight className="hidden size-4 shrink-0 text-ck-faint sm:block" />
			<div className="hidden sm:block">
				<ProjectSwitcher />
			</div>

			{/* Center: prominent wide search box (opens the ⌘K palette). The ⌘K
			    logic lives in the shell — this is only the trigger. */}
			<div className="flex flex-1 justify-center px-2">
				<button
					type="button"
					onClick={onOpenSearch}
					aria-label="Search conversations and projects"
					className="hidden h-9 w-full max-w-md items-center gap-2 rounded-[10px] border border-transparent bg-ck-chip px-3 text-sm text-ck-muted transition-colors hover:bg-ck-navhover hover:text-ck-text sm:flex"
				>
					<Search className="size-4 shrink-0" />
					<span className="flex-1 truncate text-left">
						Search conversations &amp; projects…
					</span>
					<kbd className="shrink-0 rounded border border-ck-border px-1.5 text-[11px] font-medium text-ck-faint">
						⌘K
					</kbd>
				</button>
			</div>

			{/* Mobile: icon-only search. */}
			<Button
				variant="ghost"
				size="icon"
				className="sm:hidden"
				aria-label="Search"
				onClick={onOpenSearch}
			>
				<Search className="size-5" />
			</Button>

			<Button
				variant="outline"
				size="icon"
				asChild
				className="hidden sm:inline-flex"
				aria-label="Help"
			>
				<a
					href="https://clankersupport.com/docs"
					target="_blank"
					rel="noreferrer"
				>
					<HelpCircle className="size-4" />
				</a>
			</Button>

			{/* Thin divider before the avatar (Chatbase top-right cluster). */}
			<span className="mx-1 hidden h-5 w-px bg-ck-border sm:block" />

			<AccountMenu userEmail={userEmail} roleLabel={roleLabel} />
		</header>
	);
}
