"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { api, isWorkspaceAuthError } from "@/lib/api";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { defaultSystemPrompt } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkspace } from "@/lib/workspace";

import { OnboardingShell } from "./_components/OnboardingShell";
import { OnboardingSkeleton } from "./_components/OnboardingSkeleton";
import { AllSetStep } from "./_components/steps/AllSetStep";
import {
	CreateBotStep,
	type BotDraft,
} from "./_components/steps/CreateBotStep";
import { InstallStep } from "./_components/steps/InstallStep";
import {
	SourcesStep,
	type OnboardingSource,
} from "./_components/steps/SourcesStep";
import { WelcomeStep } from "./_components/steps/WelcomeStep";

interface CreatedProject {
	id: string;
	name: string;
	publicKey: string;
	brandColor: string;
	/** The workspace the project actually landed in (may be freshly provisioned). */
	workspaceId: string;
}

export default function OnboardingPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { state, workspaceId } = useOnboardingState();
	const { setWorkspaceId } = useWorkspace();

	const [step, setStep] = useState(1);
	const [pending, setPending] = useState(false);
	const [created, setCreated] = useState<CreatedProject | null>(null);
	const [sources, setSources] = useState<OnboardingSource[]>([]);
	const [addingSource, setAddingSource] = useState(false);

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Mark the start of the onboarding funnel once.
	useEffect(() => {
		track(ANALYTICS_EVENTS.onboardingStarted);
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
			project: Omit<CreatedProject, "workspaceId">;
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

	// Step 2 → 3: create the bot. Mirrors the proven flow — create on the resolved
	// workspace; on a workspace-auth rejection (absent/stale/foreign id) provision
	// a fresh one and retry once so a broken context can't strand the user on a 403.
	async function handleCreate(draft: BotDraft) {
		setPending(true);
		try {
			let wsId = workspaceId ?? (await provisionWorkspace(draft.name));
			let project: Omit<CreatedProject, "workspaceId">;
			try {
				project = await createProject(wsId, draft);
			} catch (e) {
				if (!isWorkspaceAuthError(e)) throw e;
				wsId = await provisionWorkspace(draft.name);
				project = await createProject(wsId, draft);
			}

			setCreated({
				id: project.id,
				name: draft.name,
				publicKey: project.publicKey,
				brandColor: project.brandColor,
				workspaceId: wsId,
			});
			track(ANALYTICS_EVENTS.projectCreated, { source: "onboarding" });
			track(ANALYTICS_EVENTS.onboardingCompleted);
			setStep(3);
		} catch (e) {
			toast.error("Couldn't create your bot", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setPending(false);
		}
	}

	async function addSource(url: string) {
		if (!created) return;
		setAddingSource(true);
		try {
			const { source } = await api<{ source: OnboardingSource }>(
				`/api/projects/${created.id}/sources`,
				{ method: "POST", workspaceId: created.workspaceId, body: { url } },
			);
			setSources((prev) => [...prev, { id: source.id, url: source.url }]);
		} catch (e) {
			toast.error("Couldn't add source", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setAddingSource(false);
		}
	}

	async function deleteSource(id: string) {
		if (!created) return;
		const prev = sources;
		setSources((s) => s.filter((x) => x.id !== id)); // optimistic
		try {
			await api(`/api/projects/${created.id}/sources/${id}`, {
				method: "DELETE",
				workspaceId: created.workspaceId,
			});
		} catch (e) {
			setSources(prev); // rollback
			toast.error("Couldn't remove source", {
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
		<OnboardingShell step={step}>
			{step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
			{step === 2 && (
				<CreateBotStep
					onBack={() => setStep(1)}
					onSubmit={handleCreate}
					pending={pending}
				/>
			)}
			{step === 3 && created && (
				<SourcesStep
					sources={sources}
					onAdd={addSource}
					onDelete={deleteSource}
					onBack={() => setStep(2)}
					onContinue={() => setStep(4)}
					onSkip={() => setStep(4)}
					addPending={addingSource}
				/>
			)}
			{step === 4 && created && (
				<InstallStep
					publicKey={created.publicKey}
					brandColor={created.brandColor}
					onBack={() => setStep(3)}
					onContinue={() => setStep(5)}
				/>
			)}
			{step === 5 && created && (
				<AllSetStep
					onFinish={() => router.push(`/settings/projects/${created.id}`)}
				/>
			)}
		</OnboardingShell>
	);
}
