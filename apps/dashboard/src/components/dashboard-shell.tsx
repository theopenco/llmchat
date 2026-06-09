"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
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
			<SidebarInset>
				<header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-1 h-4" />
					<span className="font-semibold">llmchat</span>
				</header>
				<main className="flex-1">{children}</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
