"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";
import { useWorkspace } from "@/lib/workspace";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";

export default function InboxLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data, isPending } = useSession();
	const { workspaces, workspaceId } = useWorkspace();
	const router = useRouter();

	useEffect(() => {
		if (!isPending && !data?.user) {
			router.replace("/sign-in");
		}
	}, [data, isPending, router]);

	if (isPending || !data?.user) {
		return null;
	}

	const currentWorkspace = workspaces.find((w) => w.id === workspaceId);

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b bg-background px-6 py-3">
				<div className="flex items-center gap-6">
					<Link href="/inbox" className="font-semibold">
						llmchat
					</Link>
					{currentWorkspace && (
						<Badge variant="secondary">{currentWorkspace.name}</Badge>
					)}
					<nav className="flex gap-4 text-sm text-muted-foreground">
						<Link href="/inbox" className="hover:text-foreground">
							Inbox
						</Link>
						<Link href="/settings/projects" className="hover:text-foreground">
							Projects
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">
						{data.user.email}
					</span>
					<ModeToggle />
				</div>
			</header>
			<main className="flex-1">{children}</main>
		</div>
	);
}
