"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

import { ConciergeChat } from "./_components/ConciergeChat";
import { type BotDraft } from "./_components/concierge-script";
import { LiveBotPanel, type LiveProject } from "./_components/LiveBotPanel";
import { OnboardingSkeleton } from "./_components/OnboardingSkeleton";

interface CreatedProject extends LiveProject {
	/** The workspace the project actually landed in (may be freshly provisioned). */
	workspaceId: string;
}

export default function OnboardingPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { state, workspaceId } = useOnboardingState();
	const { setWorkspaceId } = useWorkspace();

	const [busy, setBusy] = useState(false);
	const [created, setCreated] = useState<CreatedProject | null>(null);
	const [setupError, setSetupError] = useState<BotDraft | null>(null);

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Mark the start of the onboarding funnel once.
	useEffect(() => {
		track(ANALYTICS_EVENTS.onboardingStarted);
	}, []);

	// Warm the live-widget chunk (AI SDK) during the interview so the payoff is
	// instant — it's lazy-loaded in LiveBotPanel to stay out of the initial load.
	useEffect(() => {
		void import("@llmchat/widget");
	}, []);

	// Already onboarded → dashboard. Suppressed once we've created a project so
	// the flow isn't yanked away when state flips to "ready".
	useEffect(() => {
		if (!created && session?.user && state === "ready")
			router.replace("/inbox");
	}, [created, session, state, router]);

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

	async function createProject(wsId: string, draft: BotDraft) {
		const { project } = await api<{
			project: { id: string; publicKey: string; brandColor: string };
		}>("/api/projects", {
			method: "POST",
			workspaceId: wsId,
			body: {
				name: draft.name,
				systemPrompt: defaultSystemPrompt(draft.name),
				welcomeMessage: draft.welcomeMessage,
				brandColor: draft.brandColor,
			},
		});
		await qc.invalidateQueries({ queryKey: ["projects", wsId] });
		return project;
	}

	// Interview complete → provision the real project. Mirrors the proven flow:
	// create on the resolved workspace; on a workspace-auth rejection (absent /
	// stale / foreign id) provision a fresh one and retry once so a broken
	// context can't strand the user on a 403.
	async function handleComplete(draft: BotDraft) {
		setBusy(true);
		setSetupError(null);
		try {
			let wsId = workspaceId ?? (await provisionWorkspace(draft.name));
			let project: { id: string; publicKey: string; brandColor: string };
			try {
				project = await createProject(wsId, draft);
			} catch (e) {
				if (!isWorkspaceAuthError(e)) throw e;
				wsId = await provisionWorkspace(draft.name);
				project = await createProject(wsId, draft);
			}

			// Optional knowledge source — non-fatal: a fetch failure must not block
			// the user from meeting their bot. They can add sources later.
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
			track(ANALYTICS_EVENTS.projectCreated, { source: "onboarding" });
			track(ANALYTICS_EVENTS.onboardingCompleted);
		} catch (e) {
			setSetupError(draft);
			setBusy(false);
			toast.error("Couldn't create your bot", {
				description: e instanceof Error ? e.message : undefined,
			});
		}
	}

	// Loading, redirecting to sign-in, or redirecting an already-onboarded user.
	// Once a project is created we keep showing the flow regardless of state.
	if (
		sessionPending ||
		!session?.user ||
		(!created && state !== "needs-onboarding")
	) {
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

			<div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
				{created ? (
					<div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
								Let&apos;s build your support bot
							</h1>
							<p className="max-w-md text-balance text-sm text-muted-foreground">
								No forms, no setup wizard. Just chat with the assistant below —
								it builds your bot from your answers as you go.
							</p>
						</header>

						<div className="mx-auto w-full max-w-sm">
							<div className="relative h-[34rem] overflow-hidden rounded-2xl border border-border shadow-xl">
								<ConciergeChat onComplete={handleComplete} busy={busy} />
							</div>

							{setupError ? (
								<div className="mt-4 flex flex-col items-center gap-2 text-center">
									<p className="text-sm text-destructive">
										Something went wrong creating your bot.
									</p>
									<Button
										variant="outline"
										onClick={() => handleComplete(setupError)}
									>
										Try again
									</Button>
								</div>
							) : (
								<p className="mt-4 text-center text-xs text-muted-foreground">
									Free to start · No code · About a minute
								</p>
							)}
						</div>
					</>
				)}
			</div>
		</main>
	);
}
