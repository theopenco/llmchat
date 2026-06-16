"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
	isBillingNotConfigured,
	openPortal,
	startCheckout,
} from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY } from "@/lib/workspace-utils";

import { BillingNotice } from "./_components/BillingNotice";
import { BillingPlanCard } from "./_components/BillingPlanCard";
import { BillingSkeleton } from "./_components/BillingSkeleton";
import { StatusBanner } from "./_components/StatusBanner";

const redirect = (url: string) => {
	window.location.href = url;
};

// A non-OK checkout/portal response shouldn't surface as a raw "API 500" — show
// a friendly inline message. Missing Stripe config gets its own copy.
const errorMessage = (e: unknown) =>
	isBillingNotConfigured(e)
		? "Billing isn't enabled yet — check back soon."
		: "Something went wrong. Please try again in a moment.";

function BillingContent() {
	const { workspaces, workspaceId, isLoading } = useWorkspace();
	const qc = useQueryClient();
	const params = useSearchParams();
	const status = params.get("status");
	const banner = status === "success" || status === "cancel" ? status : null;
	const [error, setError] = useState<string | null>(null);

	const plan = workspaces.find((w) => w.id === workspaceId)?.plan ?? "free";

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

	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 p-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
				<p className="text-sm text-muted-foreground">
					Manage your workspace plan and subscription.
				</p>
			</header>

			{banner && <StatusBanner status={banner} />}
			{error && <BillingNotice message={error} />}

			<BillingPlanCard
				plan={plan}
				pending={checkout.isPending || portal.isPending}
				onUpgrade={() => checkout.mutate()}
				onManage={() => portal.mutate()}
			/>
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
