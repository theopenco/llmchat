"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Conversation {
	id: string;
	name: string | null;
	email: string | null;
	messageCount: number;
	escalatedAt: number | null;
	archivedAt: number | null;
	updatedAt: number;
}

interface Message {
	id: string;
	role: "user" | "assistant" | "admin";
	content: string;
	sequence: number;
	createdAt: number;
}

interface Project {
	id: string;
	name: string;
}

export default function InboxPage() {
	const { workspaceId, setWorkspaceId } = useWorkspace();
	const [projectId, setProjectId] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reply, setReply] = useState("");

	const workspaces = useQuery({
		queryKey: ["workspaces"],
		queryFn: () =>
			api<{ workspaces: { workspace: { id: string; name: string } }[] }>(
				"/api/workspaces",
			),
	});

	useEffect(() => {
		const first = workspaces.data?.workspaces[0]?.workspace.id;
		if (!workspaceId && first) {
			setWorkspaceId(first);
		}
	}, [workspaces.data, workspaceId, setWorkspaceId]);

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", { workspaceId: workspaceId! }),
	});

	useEffect(() => {
		if (!projectId && projects.data?.projects[0]) {
			setProjectId(projects.data.projects[0].id);
		}
	}, [projects.data, projectId]);

	const conversations = useQuery({
		queryKey: ["conversations", projectId],
		enabled: !!projectId && !!workspaceId,
		refetchInterval: 5_000,
		queryFn: () =>
			api<{ conversations: Conversation[] }>(
				`/api/projects/${projectId}/conversations`,
				{ workspaceId: workspaceId! },
			),
	});

	const thread = useQuery({
		queryKey: ["thread", projectId, selectedId],
		enabled: !!projectId && !!selectedId && !!workspaceId,
		refetchInterval: 3_000,
		queryFn: () =>
			api<{ conversation: Conversation; messages: Message[] }>(
				`/api/projects/${projectId}/conversations/${selectedId}`,
				{ workspaceId: workspaceId! },
			),
	});

	async function handleReply() {
		if (!reply.trim() || !projectId || !selectedId || !workspaceId) {
			return;
		}
		await api(
			`/api/projects/${projectId}/conversations/${selectedId}/reply`,
			{
				method: "POST",
				body: { content: reply.trim() },
				workspaceId,
			},
		);
		setReply("");
		await thread.refetch();
		await conversations.refetch();
	}

	if (!workspaces.data?.workspaces.length) {
		return (
			<div className="p-8">
				<p className="mb-4">No workspace yet. Create one to get started.</p>
				<button
					className="rounded-md bg-gray-900 px-3 py-2 text-white"
					onClick={async () => {
						await api("/api/workspaces", {
							method: "POST",
							body: { name: "My workspace" },
						});
						await workspaces.refetch();
					}}
				>
					Create workspace
				</button>
			</div>
		);
	}

	if (!projects.data?.projects.length) {
		return (
			<div className="p-8">
				<p>
					No projects yet. Go to{" "}
					<a href="/settings/projects" className="underline">
						Projects
					</a>{" "}
					to create one.
				</p>
			</div>
		);
	}

	return (
		<div className="grid h-[calc(100vh-3.5rem)] grid-cols-[20rem_1fr]">
			<aside className="overflow-y-auto border-r border-gray-200 bg-white">
				<ul>
					{conversations.data?.conversations.map((c) => (
						<li
							key={c.id}
							className={`cursor-pointer border-b border-gray-100 p-3 hover:bg-gray-50 ${
								selectedId === c.id ? "bg-gray-100" : ""
							}`}
							onClick={() => setSelectedId(c.id)}
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">
									{c.name ?? "Anonymous"}
								</span>
								{c.escalatedAt && (
									<span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
										escalated
									</span>
								)}
							</div>
							<div className="text-xs text-gray-500">{c.email ?? "—"}</div>
							<div className="text-xs text-gray-400">
								{c.messageCount} messages
							</div>
						</li>
					))}
					{conversations.data?.conversations.length === 0 && (
						<li className="p-4 text-sm text-gray-500">
							No conversations yet.
						</li>
					)}
				</ul>
			</aside>
			<section className="flex flex-col">
				{selectedId && thread.data ? (
					<>
						<div className="flex-1 space-y-2 overflow-y-auto p-4">
							{thread.data.messages.map((m) => (
								<div
									key={m.id}
									className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
										m.role === "user"
											? "ml-auto bg-gray-900 text-white"
											: m.role === "admin"
												? "ml-auto bg-emerald-100"
												: "bg-gray-100"
									}`}
								>
									<div className="mb-0.5 text-xs opacity-60">{m.role}</div>
									<div className="whitespace-pre-wrap">{m.content}</div>
								</div>
							))}
						</div>
						<div className="border-t border-gray-200 p-3">
							<textarea
								rows={2}
								value={reply}
								onChange={(e) => setReply(e.target.value)}
								placeholder={
									thread.data.conversation.email
										? "Reply (sent via email)"
										: "Reply (note: visitor has no email, will only show in widget on next visit)"
								}
								className="w-full rounded-md border border-gray-300 p-2"
							/>
							<div className="mt-2 flex justify-end">
								<button
									onClick={handleReply}
									disabled={!reply.trim()}
									className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
								>
									Send
								</button>
							</div>
						</div>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center text-gray-400">
						Select a conversation
					</div>
				)}
			</section>
		</div>
	);
}
