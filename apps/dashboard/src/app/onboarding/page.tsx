"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { api, isWorkspaceAuthError } from "@/lib/api";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { defaultSystemPrompt, defaultWelcomeMessage } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/use-onboarding";
import { useWorkspace } from "@/lib/workspace";

import { OnboardingFinish } from "./_components/OnboardingFinish";
import { OnboardingNameStep } from "./_components/OnboardingNameStep";
import { OnboardingSkeleton } from "./_components/OnboardingSkeleton";

interface CreatedProject {
	name: string;
	publicKey: string;
	brandColor: string;
}

export default function OnboardingPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { state, workspaceId } = useOnboardingState();
	const { setWorkspaceId } = useWorkspace();
	const [pending, setPending] = useState(false);
	const [created, setCreated] = useState<CreatedProject | null>(null);

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Mark the start of the onboarding funnel once.
	useEffect(() => {
		track(ANALYTICS_EVENTS.onboardingStarted);
	}, []);

	// Already onboarded → dashboard. Suppressed once we've created a project so
	// the finish screen isn't yanked away when state flips to "ready".
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

	async function createProject(wsId: string, name: string) {
		const { project } = await api<{ project: CreatedProject }>(
			"/api/projects",
			{
				method: "POST",
				workspaceId: wsId,
				body: {
					name,
					systemPrompt: defaultSystemPrompt(name),
					welcomeMessage: defaultWelcomeMessage(name),
				},
			},
		);
		await qc.invalidateQueries({ queryKey: ["projects", wsId] });
		return project;
	}

	async function handleCreate(name: string) {
		setPending(true);
		try {
			// Sign-up provisions a workspace, but the active selection can be absent
			// (provisioning still settling) or stale/foreign (e.g. a prior account's
			// id left in localStorage, or a client-init failure). Create-on-demand,
			// then if the workspace assertion is rejected, provision a fresh one and
			// retry once so a broken context can't strand the user on a 403.
			let project: CreatedProject;
			try {
				const wsId = workspaceId ?? (await provisionWorkspace(name));
				project = await createProject(wsId, name);
			} catch (e) {
				if (!isWorkspaceAuthError(e)) throw e;
				project = await createProject(await provisionWorkspace(name), name);
			}

			setCreated({
				name,
				publicKey: project.publicKey,
				brandColor: project.brandColor,
			});
			track(ANALYTICS_EVENTS.projectCreated, { source: "onboarding" });
			track(ANALYTICS_EVENTS.onboardingCompleted);
		} catch (e) {
			toast.error("Couldn't create your chatbot", {
				description: e instanceof Error ? e.message : undefined,
			});
		} finally {
			setPending(false);
		}
	}

	if (created) {
		return (
			<main className="flex min-h-screen items-center justify-center p-6">
				<OnboardingFinish
					projectName={created.name}
					publicKey={created.publicKey}
					brandColor={created.brandColor}
				/>
			</main>
		);
	}

	if (sessionPending || !session?.user || state !== "needs-onboarding") {
		return <OnboardingSkeleton />;
	}

	return (
		<main className="flex min-h-screen items-center justify-center p-6">
			<OnboardingNameStep onSubmit={handleCreate} pending={pending} />
		</main>
	);
}
