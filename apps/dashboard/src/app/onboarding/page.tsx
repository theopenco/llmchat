"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { defaultSystemPrompt, defaultWelcomeMessage } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/use-onboarding";

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
	const [pending, setPending] = useState(false);
	const [created, setCreated] = useState<CreatedProject | null>(null);

	// Send unauthenticated visitors to sign-in.
	useEffect(() => {
		if (!sessionPending && !session?.user) router.replace("/sign-in");
	}, [sessionPending, session, router]);

	// Already onboarded → dashboard. Suppressed once we've created a project so
	// the finish screen isn't yanked away when state flips to "ready".
	useEffect(() => {
		if (!created && session?.user && state === "ready")
			router.replace("/inbox");
	}, [created, session, state, router]);

	async function handleCreate(name: string) {
		setPending(true);
		try {
			// Backstop: provisioning normally happens at sign-up, but get-or-create
			// covers accounts that somehow have no workspace.
			let wsId = workspaceId;
			if (!wsId) {
				const { workspace } = await api<{ workspace: { id: string } }>(
					"/api/workspaces",
					{ method: "POST", body: { name } },
				);
				wsId = workspace.id;
				await qc.invalidateQueries({ queryKey: ["workspaces"] });
			}

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
			setCreated({
				name,
				publicKey: project.publicKey,
				brandColor: project.brandColor,
			});
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
