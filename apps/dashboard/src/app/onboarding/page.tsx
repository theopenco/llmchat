"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { widgetStyles } from "@llmchat/widget/styles";
import { isPaidPlan } from "@llmchat/shared";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSession } from "@/lib/auth-client";
import { api, isWorkspaceAuthError } from "@/lib/api";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { fetchUsage } from "@/lib/billing";
import { defaultSystemPrompt } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/use-onboarding";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";

import { initialDraft, type BotDraft } from "./_components/bot-form";
import { LivePreview } from "./_components/LivePreview";
import { panelVisibility, type MobileView } from "./_components/mobile-view";
import { OnboardingForm } from "./_components/OnboardingForm";
import { OnboardingPaywall } from "./_components/OnboardingPaywall";
import { OnboardingSkeleton } from "./_components/OnboardingSkeleton";

function OnboardingFlow() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { state, workspaceId } = useOnboardingState();
	const { setWorkspaceId, role } = useWorkspace();

	// Resolve the active workspace's plan/exemption to gate building behind the
	// paywall (first-run only). Shares the billing-usage query cache.
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});

	// "New bot" mode: an already-onboarded user adding another agent to their
	// existing workspace. Reuses the whole flow but skips first-run-only routing.
	const newBot = useSearchParams().get("new") === "1";

	// The form draft is lifted here so the live preview (sibling) reflects it.
	const [draft, setDraft] = useState<BotDraft>(initialDraft);
	const [busy, setBusy] = useState(false);
	// The id of the just-provisioned project. Set once creation succeeds; the
	// effect below then leaves onboarding for that agent's project page.
	const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	// Mobile (< lg) shows one panel at a time; desktop shows both side-by-side and
	// ignores this. Both stay mounted, so the preview keeps updating as you type.
	const [mobileView, setMobileView] = useState<MobileView>("form");

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Mark the start of the funnel once — first-run only (new-bot isn't onboarding).
	useEffect(() => {
		if (!newBot) track(ANALYTICS_EVENTS.onboardingStarted);
	}, [newBot]);

	// Onboarding ends at the form + live preview. The moment a project exists we
	// route straight to its project page — the agent's settings, where the embed
	// snippet ("Install widget") lives. Both first-run and new-bot end here.
	useEffect(() => {
		if (createdProjectId) router.push(`/settings/projects/${createdProjectId}`);
	}, [createdProjectId, router]);

	// First-run only: an already-onboarded user landing here is sent to the
	// dashboard. In new-bot mode that's exactly who we want, so we don't redirect.
	// Suppressed once a project is created so the flow isn't yanked away.
	useEffect(() => {
		if (!newBot && !createdProjectId && session?.user && state === "ready")
			router.replace("/inbox");
	}, [newBot, createdProjectId, session, state, router]);

	// Provision a fresh (unpaid, plan "none") workspace and select it. The
	// paywall gate then prompts for a plan before any project is created.
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

			track(ANALYTICS_EVENTS.projectCreated, {
				source: newBot ? "new_bot" : "onboarding",
			});
			if (!newBot) track(ANALYTICS_EVENTS.onboardingCompleted);
			// Leave `busy` set: the redirect effect fires off this id, so the form
			// stays disabled through the navigation rather than flashing re-enabled.
			setCreatedProjectId(project.id);
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
		sessionPending ||
		!session?.user ||
		(!createdProjectId && state === "loading");
	const blockedFirstRun = !newBot && !createdProjectId && state === "ready";
	// First-run: hold the skeleton until the plan is known, so an unpaid user is
	// never flashed the build form before the paywall resolves.
	const holdForPlan =
		!newBot && !createdProjectId && !!workspaceId && usageQ.isLoading;
	// Once a project exists we're navigating to its page — hold the skeleton so
	// the form doesn't flash back before the redirect lands.
	if (createdProjectId || resolving || blockedFirstRun || holdForPlan) {
		return <OnboardingSkeleton />;
	}

	// Hard paywall before onboarding: a non-exempt workspace with no active
	// subscription must choose a plan before building. New-bot mode (adding to an
	// already-paid workspace) skips it. Building is ALSO blocked server-side
	// (POST /api/projects → 402 subscription_required), so the gate can't be
	// bypassed by skipping the UI.
	const access = usageQ.data;
	const needsPaywall =
		!newBot &&
		!createdProjectId &&
		!!workspaceId &&
		!!access &&
		!access.exempt &&
		!isPaidPlan(access.plan);

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
				{needsPaywall && workspaceId ? (
					<OnboardingPaywall
						workspaceId={workspaceId}
						canManage={role === "owner"}
					/>
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

						<div className="flex flex-col gap-4">
							{/* Mobile/tablet: flip between the form and the live preview (both
							    stay mounted, so the preview keeps updating). Hidden on
							    desktop, where the two panels sit side-by-side. */}
							<ToggleGroup
								type="single"
								value={mobileView}
								onValueChange={(v) => v && setMobileView(v as MobileView)}
								variant="outline"
								aria-label="Switch between the setup form and the live preview"
								className="w-full lg:hidden"
							>
								<ToggleGroupItem value="form" className="flex-1">
									Setup
								</ToggleGroupItem>
								<ToggleGroupItem value="preview" className="flex-1">
									Live preview
								</ToggleGroupItem>
							</ToggleGroup>

							<div className="grid items-start gap-8 lg:grid-cols-2">
								<div
									className={cn("min-w-0", panelVisibility("form", mobileView))}
								>
									<OnboardingForm
										draft={draft}
										onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
										onSubmit={handleComplete}
										busy={busy}
										primaryLabel={
											newBot ? "Create this agent" : "Create my agent"
										}
									/>
								</div>

								<div
									className={cn(
										"min-w-0 lg:sticky lg:top-10",
										panelVisibility("preview", mobileView),
									)}
								>
									<LivePreview
										name={draft.name}
										welcomeMessage={draft.welcomeMessage}
										brandColor={draft.brandColor}
									/>
								</div>
							</div>
						</div>

						{/* Retry lives below both panels so it's reachable in either mobile
						    view (not buried inside the hidden preview column). */}
						{failed && (
							<div className="flex flex-col items-center gap-2 text-center">
								<p className="text-sm text-destructive">
									Something went wrong creating your agent.
								</p>
								<Button variant="outline" onClick={handleComplete}>
									Try again
								</Button>
							</div>
						)}
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
