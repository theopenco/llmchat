"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";
import { useWorkspace } from "@/lib/workspace";

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
			<header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
				<div className="flex items-center gap-6">
					<Link href="/inbox" className="font-semibold">
						llmchat
					</Link>
					{currentWorkspace && (
						<span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
							{currentWorkspace.name}
						</span>
					)}
					<nav className="flex gap-4 text-sm text-gray-600">
						<Link href="/inbox">Inbox</Link>
						<Link href="/settings/projects">Projects</Link>
					</nav>
				</div>
				<div className="text-sm text-gray-600">{data.user.email}</div>
			</header>
			<main className="flex-1">{children}</main>
		</div>
	);
}
