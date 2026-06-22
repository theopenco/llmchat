"use client";

import { ChevronRight, HelpCircle, Menu as MenuIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ds";
import { AccountMenu } from "@/components/shell/account-menu";
import { ProjectSwitcher } from "@/components/shell/project-switcher";
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher";

/**
 * The Command Bar: logo · workspace ▸ project switchers · Help · account menu.
 * Height is h-12 (mobile) / h-14 (desktop) on purpose — the inbox sizes itself
 * as calc(100dvh-3rem) / calc(100vh-3.5rem), so matching keeps it full-height
 * without touching the page. No search box (inbox search isn't URL-routable),
 * no ⌘K, no notifications — all intentionally omitted, nothing inert.
 */
export function TopBar({
	userEmail,
	roleLabel,
	onOpenSidebar,
}: {
	userEmail: string;
	roleLabel: string;
	onOpenSidebar: () => void;
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

			<div className="flex-1" />

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

			<AccountMenu userEmail={userEmail} roleLabel={roleLabel} />
		</header>
	);
}
