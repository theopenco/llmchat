"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Project {
	id: string;
	name: string;
	publicKey: string;
	systemPrompt: string;
	knowledgeText: string;
	model: string;
	brandColor: string;
	welcomeMessage: string;
	escalationThreshold: number;
	notifyEmail: string | null;
	slackWebhookUrl: string | null;
}

export default function ProjectSettingsPage() {
	const { id } = useParams<{ id: string }>();
	const { workspaceId } = useWorkspace();
	const qc = useQueryClient();
	const [draft, setDraft] = useState<Partial<Project>>({});

	const project = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
		select: (d) => d.projects.find((p) => p.id === id),
	});

	useEffect(() => {
		if (project.data) {
			setDraft(project.data);
		}
	}, [project.data]);

	const save = useMutation({
		mutationFn: (input: Partial<Project>) =>
			api(`/api/projects/${id}`, {
				method: "PATCH",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
	});

	if (!project.data) {
		return <div className="p-6">Loading…</div>;
	}

	const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
	const embed = `<script src="${apiUrl}/widget.js" data-project="${project.data.publicKey}" data-api="${apiUrl}" data-brand="${draft.brandColor ?? project.data.brandColor}"></script>`;

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			<h1 className="text-xl font-semibold">{project.data.name}</h1>

			<section className="space-y-2">
				<label className="block text-sm font-medium">Embed snippet</label>
				<pre className="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
					{embed}
				</pre>
			</section>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					save.mutate(draft);
				}}
				className="space-y-4 rounded-xl bg-white p-6 shadow"
			>
				<Field label="Name">
					<input
						value={draft.name ?? ""}
						onChange={(e) => setDraft({ ...draft, name: e.target.value })}
					/>
				</Field>
				<Field label="Model (provider/model id)">
					<input
						value={draft.model ?? ""}
						onChange={(e) => setDraft({ ...draft, model: e.target.value })}
					/>
				</Field>
				<Field label="Brand color">
					<input
						type="color"
						value={draft.brandColor ?? "#000000"}
						onChange={(e) =>
							setDraft({ ...draft, brandColor: e.target.value })
						}
					/>
				</Field>
				<Field label="Welcome message">
					<input
						value={draft.welcomeMessage ?? ""}
						onChange={(e) =>
							setDraft({ ...draft, welcomeMessage: e.target.value })
						}
					/>
				</Field>
				<Field label="System prompt">
					<textarea
						rows={6}
						value={draft.systemPrompt ?? ""}
						onChange={(e) =>
							setDraft({ ...draft, systemPrompt: e.target.value })
						}
					/>
				</Field>
				<Field label="Knowledge base (markdown)">
					<textarea
						rows={10}
						value={draft.knowledgeText ?? ""}
						onChange={(e) =>
							setDraft({ ...draft, knowledgeText: e.target.value })
						}
					/>
				</Field>
				<Field label="Escalation threshold">
					<input
						type="number"
						min={1}
						value={draft.escalationThreshold ?? 3}
						onChange={(e) =>
							setDraft({
								...draft,
								escalationThreshold: parseInt(e.target.value, 10),
							})
						}
					/>
				</Field>
				<Field label="Notify email (where escalations go)">
					<input
						type="email"
						value={draft.notifyEmail ?? ""}
						onChange={(e) =>
							setDraft({ ...draft, notifyEmail: e.target.value || null })
						}
					/>
				</Field>
				<Field label="Slack webhook URL (optional)">
					<input
						type="url"
						value={draft.slackWebhookUrl ?? ""}
						onChange={(e) =>
							setDraft({
								...draft,
								slackWebhookUrl: e.target.value || null,
							})
						}
					/>
				</Field>
				<div className="flex justify-end">
					<button
						type="submit"
						disabled={save.isPending}
						className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
					>
						{save.isPending ? "Saving…" : "Save"}
					</button>
				</div>
			</form>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="block">
			<span className="mb-1 block text-sm font-medium">{label}</span>
			<div className="[&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:border-gray-300 [&>input]:px-3 [&>input]:py-2 [&>textarea]:w-full [&>textarea]:rounded-md [&>textarea]:border [&>textarea]:border-gray-300 [&>textarea]:px-3 [&>textarea]:py-2 [&>textarea]:font-mono [&>textarea]:text-xs">
				{children}
			</div>
		</label>
	);
}
