"use client";

import { FolderOpen } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

function InboxEmpty({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<Empty className="m-8">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<FolderOpen />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>{children}</EmptyContent>
		</Empty>
	);
}

export function NoWorkspaceEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<InboxEmpty
			title="No workspace yet"
			description="Create a workspace to start receiving conversations."
		>
			<Button onClick={onCreate}>Create workspace</Button>
		</InboxEmpty>
	);
}

export function NoProjectsEmpty() {
	return (
		<InboxEmpty
			title="No projects yet"
			description="Create your first project to get started."
		>
			<Button asChild>
				<Link href="/settings/projects">Go to Projects</Link>
			</Button>
		</InboxEmpty>
	);
}
