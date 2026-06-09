"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";
import { AppSidebar } from "@/components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
	const { data, isPending } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (!isPending && !data?.user) {
			router.replace("/sign-in");
		}
	}, [data, isPending, router]);

	if (isPending || !data?.user) {
		return null;
	}

	return (
		<SidebarProvider>
			<AppSidebar userEmail={data.user.email} />
			<SidebarInset className="bg-muted">
				{/* Mobile-only bar to open the sidebar drawer; desktop matches the mockup with no top bar. */}
				<header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
					<SidebarTrigger className="-ml-1" />
					<span className="font-semibold">LLMChat</span>
				</header>
				<main className="flex-1">{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
