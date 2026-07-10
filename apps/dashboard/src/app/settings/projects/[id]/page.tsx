"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ds";
import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_KEY, fetchAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { fetchUsage } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";

import { DeleteProjectDialog } from "../_components/DeleteProjectDialog";
import { BehaviorTab } from "./_tabs/BehaviorTab";
import { GeneralTab } from "./_tabs/GeneralTab";
import { IntegrationsTab } from "./_tabs/IntegrationsTab";
import { MembersTab } from "./_tabs/MembersTab";
import { WidgetTab } from "./_tabs/WidgetTab";
import { useProjectMutations } from "./useProjectMutations";
import type { Project, ProjectDraft } from "./types";

// Every editable column lives in the draft; handleSave PATCHes only the dirty
// ones (partial), so a single save bar serves all tabs.
const EDITABLE_KEYS: (keyof ProjectDraft)[] = [
	"name",
	"welcomeMessage",
	"brandColor",
	"model",
	"systemPrompt",
	"escalationThreshold",
	"notifyEmail",
	"slackWebhookUrl",
	"privacyPolicyUrl",
	"suggestedQuestions",
];

function toDraft(p: Project): ProjectDraft {
	return {
		name: p.name,
		welcomeMessage: p.welcomeMessage,
		brandColor: p.brandColor,
		model: p.model,
		systemPrompt: p.systemPrompt,
		escalationThreshold: p.escalationThreshold,
		notifyEmail: p.notifyEmail,
		slackWebhookUrl: p.slackWebhookUrl,
		privacyPolicyUrl: p.privacyPolicyUrl,
		// Fallback: a cached project fetched before the column existed.
		suggestedQuestions: p.suggestedQuestions ?? [],
	};
}

/** Draft-vs-saved equality; arrays (suggestedQuestions) compare by content,
 * everything else by identity like before. */
function sameValue(a: unknown, b: unknown): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	}
	return a === b;
}

type Tab = "general" | "widget" | "behavior" | "integrations" | "members";
const TABS: { id: Tab; label: string }[] = [
	{ id: "general", label: "General" },
	{ id: "widget", label: "Widget" },
	{ id: "behavior", label: "Behavior" },
	{ id: "integrations", label: "Integrations" },
	{ id: "members", label: "Members" },
];

export default function ProjectSettingsPage() {
	const { id } = useParams<{ id: string }>();
	const { workspaceId, role } = useWorkspace();

	const [tab, setTab] = useState<Tab>("general");
	const [draft, setDraft] = useState<ProjectDraft | null>(null);
	const [showDelete, setShowDelete] = useState(false);

	const projectQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
		select: (d) => d.projects.find((p) => p.id === id),
	});
	const project = projectQ.data;

	// Powered-by state (read-only) + owner email (Members) from already-cached
	// queries — no new endpoints.
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});
	const accountQ = useQuery({ queryKey: ACCOUNT_KEY, queryFn: fetchAccount });

	useEffect(() => {
		if (project) setDraft(toDraft(project));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [project?.id]);

	const { save, remove } = useProjectMutations(id, workspaceId);

	if (!project || !draft) {
		return (
			<PageContainer>
				<Skeleton className="h-8 w-64" />
				<div className="mt-6 flex gap-6">
					<Skeleton className="h-40 w-44 shrink-0 rounded-2xl" />
					<Skeleton className="h-80 flex-1 rounded-2xl" />
				</div>
			</PageContainer>
		);
	}

	function set<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
		setDraft((d) => (d ? { ...d, [key]: value } : d));
	}

	// Compare against the normalized saved state (toDraft) so a legacy cached
	// project without suggestedQuestions doesn't read as permanently dirty.
	const saved = toDraft(project);
	const dirtyKeys = EDITABLE_KEYS.filter(
		(k) => !sameValue(draft![k], saved[k]),
	);
	const dirty = dirtyKeys.length > 0;

	function handleSave() {
		if (!dirty || !draft) return;
		const payload: Partial<Project> = {};
		for (const k of dirtyKeys) {
			(payload as Record<string, unknown>)[k] = draft[k];
		}
		// Drop blank chip rows (the editor allows an empty row while typing).
		if (payload.suggestedQuestions) {
			payload.suggestedQuestions = payload.suggestedQuestions
				.map((q) => q.trim())
				.filter(Boolean);
		}
		// Editing Instructions makes systemPrompt authoritative — clear any active
		// library prompt that would override it.
		if (dirtyKeys.includes("systemPrompt")) payload.activeSystemPromptId = null;
		save.mutate(payload);
	}

	return (
		<PageContainer>
			<header className="mb-6">
				<h1 className="truncate text-2xl font-extrabold tracking-[-0.02em] text-ck-text">
					{project.name}
				</h1>
				<p className="mt-1 text-sm text-ck-muted">Project settings</p>
			</header>

			<div className="flex flex-col gap-6 sm:flex-row">
				{/* Left subnav (the design's General/Widget/Behavior/Members). */}
				<nav className="flex shrink-0 gap-1 sm:w-44 sm:flex-col">
					{TABS.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							className={cn(
								"rounded-[10px] px-3 py-2 text-left text-[13.5px] font-semibold transition-colors",
								tab === t.id
									? "bg-ck-accent text-white"
									: "text-ck-muted hover:bg-ck-navhover hover:text-ck-text",
							)}
						>
							{t.label}
						</button>
					))}
				</nav>

				<div className="min-w-0 flex-1 pb-20">
					{tab === "general" && (
						<GeneralTab
							draft={draft}
							set={set}
							branding={usageQ.data?.entitlements.branding}
							onRequestDelete={() => setShowDelete(true)}
						/>
					)}
					{tab === "widget" && (
						<WidgetTab draft={draft} set={set} publicKey={project.publicKey} />
					)}
					{tab === "behavior" && <BehaviorTab draft={draft} set={set} />}
					{tab === "integrations" && (
						<IntegrationsTab
							projectId={id}
							workspaceId={workspaceId!}
							canManage={role === "owner" || role === "admin"}
						/>
					)}
					{tab === "members" && (
						<MembersTab ownerEmail={accountQ.data?.email ?? null} role={role} />
					)}
				</div>
			</div>

			{/* One save bar for all tabs — saves only the dirty fields (PATCH partial). */}
			{dirty && (
				<div className="fixed inset-x-0 bottom-0 z-20 border-t border-ck-border bg-ck-topbar/95 backdrop-blur md:left-60">
					{/* Inner width matches PageContainer so the bar lines up with content. */}
					<div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-6 py-3 sm:px-8">
						<span className="text-[12.5px] text-ck-muted">Unsaved changes</span>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setDraft(toDraft(project))}
								disabled={save.isPending}
							>
								Cancel
							</Button>
							<Button size="sm" onClick={handleSave} disabled={save.isPending}>
								{save.isPending ? "Saving…" : "Save changes"}
							</Button>
						</div>
					</div>
				</div>
			)}

			<DeleteProjectDialog
				open={showDelete}
				onOpenChange={setShowDelete}
				onConfirm={() => remove.mutate()}
				pending={remove.isPending}
			/>
		</PageContainer>
	);
}
