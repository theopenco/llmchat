"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
	isBillingNotConfigured,
	openPortal,
	startCheckout,
} from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY } from "@/lib/workspace-utils";

import { BillingNotice } from "./_components/BillingNotice";
import { BillingSkeleton } from "./_components/BillingSkeleton";
import { CurrentPlanCard } from "./_components/CurrentPlanCard";
import { CustomPlanBanner } from "./_components/CustomPlanBanner";
import { PricingTiers } from "./_components/PricingTiers";
import { StatusBanner } from "./_components/StatusBanner";
import { UsageCard } from "./_components/UsageCard";

const redirect = (url: string) => {
	window.location.href = url;
};

// A non-OK checkout/portal response shouldn't surface as a raw "API 500" — show
// a friendly inline message. Missing Stripe config gets its own copy.
const errorMessage = (e: unknown) =>
	isBillingNotConfigured(e)
		? "Billing isn't enabled yet — check back soon."
		: "Something went wrong. Please try again in a moment.";

/** Annual billing has no Stripe price yet, so the toggle is cosmetic/disabled
 * (and we don't advertise a fake annual discount). */
function CadenceToggle() {
	return (
		<div className="inline-flex items-center gap-0.5 rounded-full border p-0.5 text-sm">
			<span className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground">
				Monthly
			</span>
			<button
				type="button"
				disabled
				title="Annual billing is coming soon"
				className="cursor-not-allowed rounded-full px-3 py-1 text-muted-foreground opacity-60"
			>
				Yearly
			</button>
		</div>
	);
}

function BillingContent() {
	const { workspaces, workspaceId, isLoading } = useWorkspace();
	const qc = useQueryClient();
	const params = useSearchParams();
	const status = params.get("status");
	const banner = status === "success" || status === "cancel" ? status : null;
	const [error, setError] = useState<string | null>(null);

	const plan = workspaces.find((w) => w.id === workspaceId)?.plan ?? "free";

	// Real project count for the usage card (no fabricated message totals).
	const projectsQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: unknown[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});
	const projectCount = projectsQ.data?.projects.length ?? null;

	// Returning from a successful Checkout, the webhook may have just flipped the
	// plan server-side — refetch the workspace so the card reflects it.
	useEffect(() => {
		if (status === "success") {
			void qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
		}
	}, [status, qc]);

	const checkout = useMutation({
		mutationFn: () => startCheckout(workspaceId!),
		onMutate: () => setError(null),
		onSuccess: redirect,
		onError: (e) => setError(errorMessage(e)),
	});
	const portal = useMutation({
		mutationFn: () => openPortal(workspaceId!),
		onMutate: () => setError(null),
		onSuccess: redirect,
		onError: (e) => setError(errorMessage(e)),
	});

	if (isLoading || !workspaceId) return <BillingSkeleton />;

	const pending = checkout.isPending || portal.isPending;

	return (
		<div className="mx-auto w-full max-w-[1100px] space-y-6 p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="font-display text-2xl font-semibold tracking-tight-display">
						Billing
					</h1>
					<p className="text-sm text-muted-foreground">
						Manage your workspace plan and subscription.
					</p>
				</div>
				<CadenceToggle />
			</header>

			{banner && <StatusBanner status={banner} />}
			{error && <BillingNotice message={error} />}

			<div className="grid gap-4 md:grid-cols-2">
				<CurrentPlanCard
					plan={plan}
					pending={pending}
					onUpgrade={() => checkout.mutate()}
					onManage={() => portal.mutate()}
				/>
				<UsageCard projectCount={projectCount} />
			</div>

			<PricingTiers
				currentPlan={plan}
				pending={pending}
				onUpgrade={() => checkout.mutate()}
			/>

			<CustomPlanBanner />
		</div>
	);
}

export default function BillingPage() {
	// useSearchParams requires a Suspense boundary; the skeleton doubles as the
	// fallback so there's no layout shift.
	return (
		<Suspense fallback={<BillingSkeleton />}>
			<BillingContent />
		</Suspense>
	);
}
