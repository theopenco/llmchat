"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { widgetStyles } from "@llmchat/widget/styles";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { api, isWorkspaceAuthError } from "@/lib/api";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { defaultSystemPrompt } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkspace } from "@/lib/workspace";

import { initialDraft, type BotDraft } from "./_components/bot-form";
import { LiveBotPanel, type LiveProject } from "./_components/LiveBotPanel";
import { LivePreview } from "./_components/LivePreview";
import { OnboardingForm } from "./_components/OnboardingForm";
import { OnboardingSkeleton } from "./_components/OnboardingSkeleton";

interface CreatedProject extends LiveProject {
	/** The workspace the project actually landed in (may be freshly provisioned). */
	workspaceId: string;
}

function OnboardingFlow() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { state, workspaceId } = useOnboardingState();
	const { setWorkspaceId } = useWorkspace();

	// "New bot" mode: an already-onboarded user adding another agent to their
	// existing workspace. Reuses the whole flow but skips first-run-only routing.
	const newBot = useSearchParams().get("new") === "1";

	// The form draft is lifted here so the live preview (sibling) reflects it.
	const [draft, setDraft] = useState<BotDraft>(initialDraft);
	const [busy, setBusy] = useState(false);
	const [created, setCreated] = useState<CreatedProject | null>(null);
	const [failed, setFailed] = useState(false);

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Mark the start of the funnel once — first-run only (new-bot isn't onboarding).
	useEffect(() => {
		if (!newBot) track(ANALYTICS_EVENTS.onboardingStarted);
	}, [newBot]);

	// Warm the live-widget chunk (AI SDK) while they fill the form so the payoff
	// is instant — it's lazy-loaded in LiveBotPanel to stay out of the initial load.
	useEffect(() => {
		void import("@llmchat/widget");
	}, []);

	// First-run only: an already-onboarded user landing here is sent to the
	// dashboard. In new-bot mode that's exactly who we want, so we don't redirect.
	// Suppressed once a project is created so the flow isn't yanked away.
	useEffect(() => {
		if (!newBot && !created && session?.user && state === "ready")
			router.replace("/inbox");
	}, [newBot, created, session, state, router]);

	// Provision a fresh free-plan workspace and make it the active selection.
	async function provisionWorkspace(name: string): Promise<string> {
		const { workspace } = await api<{ workspace: { id: string } }>(
			"/api/workspaces",
			{ method: "POST", body: { name } },
		);
		setWorkspaceId(workspace.id);
		await qc.invalidateQueries({ queryKey: ["workspaces"] });
		return workspace.id;
	}

	async function createProject(wsId: string, d: BotDraft) {
		const { project } = await api<{
			project: { id: string; publicKey: string; brandColor: string };
		}>("/api/projects", {
			method: "POST",
			workspaceId: wsId,
			body: {
				name: d.name,
				systemPrompt: defaultSystemPrompt(d.name),
				welcomeMessage: d.welcomeMessage,
				brandColor: d.brandColor,
			},
		});
		await qc.invalidateQueries({ queryKey: ["projects", wsId] });
		return project;
	}

	// Form submitted → provision the project.
	//
	// First-run: create on the resolved workspace; on a workspace-auth rejection
	// (absent / stale / foreign id) provision a fresh one and retry once so a
	// broken context can't strand the user on a 403.
	//
	// New-bot: the workspace already exists and is resolved (the guard waits for
	// it), so we always create a *new* project inside it and never re-provision
	// the workspace — a 403 surfaces as an error instead of spawning a workspace.
	async function handleComplete() {
		setBusy(true);
		setFailed(false);
		try {
			let wsId = workspaceId ?? (await provisionWorkspace(draft.name));
			let project: { id: string; publicKey: string; brandColor: string };
			try {
				project = await createProject(wsId, draft);
			} catch (e) {
				if (newBot || !isWorkspaceAuthError(e)) throw e;
				wsId = await provisionWorkspace(draft.name);
				project = await createProject(wsId, draft);
			}

			// Optional knowledge source — non-fatal: a fetch failure must not block
			// the user from meeting their agent. They can add sources later.
			if (draft.sourceUrl) {
				try {
					await api(`/api/projects/${project.id}/sources`, {
						method: "POST",
						workspaceId: wsId,
						body: { url: draft.sourceUrl },
					});
				} catch {
					toast.warning("Couldn't add that source", {
						description: "You can add it later from the project's settings.",
					});
				}
			}

			setCreated({
				id: project.id,
				name: draft.name,
				publicKey: project.publicKey,
				brandColor: draft.brandColor,
				workspaceId: wsId,
			});
			track(ANALYTICS_EVENTS.projectCreated, {
				source: newBot ? "new_bot" : "onboarding",
			});
			if (!newBot) track(ANALYTICS_EVENTS.onboardingCompleted);
		} catch (e) {
			setFailed(true);
			setBusy(false);
			toast.error("Couldn't create your agent", {
				description: e instanceof Error ? e.message : undefined,
			});
		}
	}

	// Wait for the session + workspace to resolve before deciding anything.
	// First-run: an already-onboarded user (state "ready") is bounced to the
	// dashboard by the effect above, so we hold the skeleton. New-bot: we want
	// the "ready" user, so we only hold while still loading.
	const resolving =
		sessionPending || !session?.user || (!created && state === "loading");
	const blockedFirstRun = !newBot && !created && state === "ready";
	if (resolving || blockedFirstRun) {
		return <OnboardingSkeleton />;
	}

	return (
		<main className="relative min-h-svh overflow-hidden bg-background text-foreground">
			{/* Widget chat styles — every rule is scoped under `.llmchat`, so this
			    can't leak into the dashboard's own UI. */}
			<style dangerouslySetInnerHTML={{ __html: widgetStyles }} />

			{/* Brand glow — low-opacity radial blobs that read on both themes. */}
			<div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
				<div className="absolute left-1/2 top-[-8rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/20" />
				<div className="absolute right-[-6rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-3xl dark:bg-violet-600/15" />
			</div>

			<div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
				{created ? (
					<div className="animate-in fade-in slide-in-from-bottom-2 mx-auto w-full max-w-2xl duration-500">
						<LiveBotPanel
							project={created}
							onFinish={() => router.push(`/settings/projects/${created.id}`)}
						/>
					</div>
				) : (
					<>
						<header className="flex flex-col items-center gap-3 text-center">
							<BrandLogo className="size-11" />
							<h1 className="font-display text-3xl font-semibold tracking-tight-display">
								{newBot
									? "Add another support agent"
									: "Let's build your support agent"}
							</h1>
							<p className="max-w-md text-balance text-sm text-muted-foreground">
								Fill in the details and watch your agent come to life on the
								right. Live in about a minute.
							</p>
						</header>

						<div className="grid items-start gap-8 lg:grid-cols-2">
							<OnboardingForm
								draft={draft}
								onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
								onSubmit={handleComplete}
								busy={busy}
								primaryLabel={newBot ? "Create this agent" : "Create my agent"}
							/>

							<div className="lg:sticky lg:top-10">
								<LivePreview
									name={draft.name}
									welcomeMessage={draft.welcomeMessage}
									brandColor={draft.brandColor}
								/>
								{failed && (
									<div className="mt-4 flex flex-col items-center gap-2 text-center">
										<p className="text-sm text-destructive">
											Something went wrong creating your agent.
										</p>
										<Button variant="outline" onClick={handleComplete}>
											Try again
										</Button>
									</div>
								)}
							</div>
						</div>
					</>
				)}
			</div>
		</main>
	);
}

export default function OnboardingPage() {
	// useSearchParams needs a Suspense boundary; the skeleton doubles as the
	// fallback so there's no flash before the flow resolves.
	return (
		<Suspense fallback={<OnboardingSkeleton />}>
			<OnboardingFlow />
		</Suspense>
	);
}
