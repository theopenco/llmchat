"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CommandPalette } from "@/components/shell/command-palette";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { LaunchBanner } from "@/components/launch-banner";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { TopBar } from "@/components/shell/top-bar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "@/lib/auth-client";
import { useOnboardingRedirect } from "@/lib/use-onboarding-redirect";
import { SelectedProjectProvider } from "@/lib/use-selected-project";
import { useWorkspace } from "@/lib/workspace";

export function DashboardShell({
	children,
	initialEmail,
}: {
	children: React.ReactNode;
	/** Email resolved on the server; when present we skip the client auth gate. */
	initialEmail?: string;
}) {
	const { data, isPending } = useSession();
	const { role } = useWorkspace();
	const router = useRouter();
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);

	const email = initialEmail ?? data?.user?.email;
	const roleLabel = role ? role[0].toUpperCase() + role.slice(1) : "Member";

	// Global ⌘K / Ctrl+K toggles the command palette from anywhere in the
	// dashboard. (⌘K isn't a printable character, so this never hijacks typing.)
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			// Respect a handler that already consumed the chord (e.g. a focused
			// editor's own ⌘K binding) before we hijack it for the palette.
			if (e.defaultPrevented) return;
			if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setSearchOpen((v) => !v);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		// Only client-gate when the server didn't already confirm a session.
		if (initialEmail) return;
		if (!isPending && !data?.user) {
			router.replace("/sign-in");
		}
	}, [initialEmail, data, isPending, router]);

	// Send users with no workspace / no projects to the onboarding flow.
	useOnboardingRedirect(!!email);

	if (!email) {
		// Still resolving the session client-side -> show the shell skeleton;
		// once resolved-as-unauthenticated the redirect effect takes over.
		return isPending ? <DashboardSkeleton /> : null;
	}

	return (
		<SelectedProjectProvider>
			{/* Frame: full-width Command Bar over a [sidebar | main] row. h-dvh +
			    min-h-0 keeps a bounded main so the inbox's full-height panes and the
			    scrollable content pages both behave. */}
			<div className="flex h-dvh flex-col bg-ck-app text-ck-text">
				<TopBar
					userEmail={email}
					roleLabel={roleLabel}
					onOpenSidebar={() => setMobileNavOpen(true)}
					onOpenSearch={() => setSearchOpen(true)}
				/>
				<CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

				<div className="flex min-h-0 flex-1">
					{/* Desktop sidebar */}
					<aside className="hidden w-60 shrink-0 border-r border-ck-border bg-ck-sidebar md:block">
						<SidebarNav />
					</aside>

					{/* Mobile sidebar drawer */}
					<Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
						<SheetContent
							side="left"
							className="w-60 border-ck-border bg-ck-sidebar p-0"
						>
							<SheetTitle className="sr-only">Navigation</SheetTitle>
							<SidebarNav />
						</SheetContent>
					</Sheet>

					{/* Main: a bounded flex column. The banner is shrink-0 chrome; the
					    inner div is the single scroll container for page content. This
					    way a full-height page (the inbox, via h-full) gets exactly the
					    space below the banner — no viewport-vs-chrome mismatch — and a
					    tall content page scrolls inside main, never the document. */}
					<main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-ck-app">
						<LaunchBanner />
						<div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
					</main>
				</div>
			</div>
		</SelectedProjectProvider>
	);
}
