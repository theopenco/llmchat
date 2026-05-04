"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Project {
	id: string;
	name: string;
	publicKey: string;
	model: string;
}

export default function ProjectsPage() {
	const { workspaceId } = useWorkspace();
	const qc = useQueryClient();
	const [name, setName] = useState("");

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});

	const create = useMutation({
		mutationFn: (input: { name: string }) =>
			api("/api/projects", {
				method: "POST",
				body: input,
				workspaceId: workspaceId!,
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
	});

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6">
			<h1 className="text-xl font-semibold">Projects</h1>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!name.trim()) {
						return;
					}
					create.mutate({ name: name.trim() });
					setName("");
				}}
				className="flex gap-2"
			>
				<input
					placeholder="New project name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="flex-1 rounded-md border border-gray-300 px-3 py-2"
				/>
				<button
					type="submit"
					className="rounded-md bg-gray-900 px-3 py-2 text-white"
				>
					Create
				</button>
			</form>
			<ul className="divide-y divide-gray-200 rounded-xl bg-white shadow">
				{projects.data?.projects.map((p) => (
					<li key={p.id} className="flex items-center justify-between p-4">
						<div>
							<div className="font-medium">{p.name}</div>
							<div className="font-mono text-xs text-gray-500">
								{p.publicKey}
							</div>
						</div>
						<Link
							href={`/settings/projects/${p.id}`}
							className="text-sm text-gray-700 underline"
						>
							Configure
						</Link>
					</li>
				))}
				{projects.data?.projects.length === 0 && (
					<li className="p-4 text-sm text-gray-500">No projects yet.</li>
				)}
			</ul>
		</div>
	);
}
