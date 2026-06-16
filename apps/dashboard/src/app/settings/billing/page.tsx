"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

import { openPortal, startCheckout } from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY } from "@/lib/workspace-utils";

import { BillingPlanCard } from "./_components/BillingPlanCard";
import { BillingSkeleton } from "./_components/BillingSkeleton";
import { StatusBanner } from "./_components/StatusBanner";

function BillingContent() {
	const { workspaces, workspaceId, isLoading } = useWorkspace();
	const qc = useQueryClient();
	const params = useSearchParams();
	const status = params.get("status");
	const banner = status === "success" || status === "cancel" ? status : null;

	const plan = workspaces.find((w) => w.id === workspaceId)?.plan ?? "free";

	// Returning from a successful Checkout, the webhook may have just flipped the
	// plan server-side — refetch the workspace so the card reflects it.
	useEffect(() => {
		if (status === "success") {
			void qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
		}
	}, [status, qc]);

	const redirect = (url: string) => {
		window.location.href = url;
	};
	const onError = (label: string) => (e: unknown) =>
		toast.error(label, {
			description: e instanceof Error ? e.message : undefined,
		});

	const checkout = useMutation({
		mutationFn: () => startCheckout(workspaceId!),
		onSuccess: redirect,
		onError: onError("Couldn't start checkout"),
	});
	const portal = useMutation({
		mutationFn: () => openPortal(workspaceId!),
		onSuccess: redirect,
		onError: onError("Couldn't open the billing portal"),
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
