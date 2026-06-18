"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import { useOnboardingRedirect } from "@/lib/use-onboarding-redirect";

export function DashboardShell({
	children,
	initialEmail,
}: {
	children: React.ReactNode;
	/** Email resolved on the server; when present we skip the client auth gate. */
	initialEmail?: string;
}) {
	const { data, isPending } = useSession();
	const router = useRouter();

	const email = initialEmail ?? data?.user?.email;

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
		<SidebarProvider>
			<AppSidebar userEmail={email} />
			<SidebarInset className="bg-transparent">
				{/* Mobile-only bar to open the sidebar drawer; desktop matches the mockup with no top bar. */}
				<header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
					<SidebarTrigger className="-ml-1" />
					<span className="font-display font-semibold tracking-tight-display">
						llmchat
					</span>
				</header>
				<main className="flex-1">{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
