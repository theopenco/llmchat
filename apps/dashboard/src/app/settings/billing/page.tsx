"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
	fetchUsage,
	isBillingNotConfigured,
	openPortal,
	redirectToStripeCheckout,
	startCheckout,
} from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";
import { WORKSPACES_KEY } from "@/lib/workspace-utils";

import type { PaidPlan } from "@llmchat/shared";

import { BillingNotice } from "./_components/BillingNotice";
import { BillingSkeleton } from "./_components/BillingSkeleton";
import { TIERS } from "./_components/billing-plans";
import { PlanTiers } from "./_components/PlanTiers";
import { PlanUsageCard } from "./_components/PlanUsageCard";
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
	const { workspaces, workspaceId, role, isLoading } = useWorkspace();
	const qc = useQueryClient();
	const params = useSearchParams();
	const status = params.get("status");
	const banner = status === "success" || status === "cancel" ? status : null;
	const [error, setError] = useState<string | null>(null);

	const plan = workspaces.find((w) => w.id === workspaceId)?.plan ?? "none";
	const isOwner = role === "owner";
	const priceUsdMonthly = TIERS.find((t) => t.plan === plan)?.priceUsdMonthly;

	// Real usage-this-month (plan, entitlements, counts) for the meters.
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});
	const exempt = usageQ.data?.exempt ?? false;

	// Returning from a successful Checkout, the webhook may have just flipped the
	// plan server-side — refetch the workspace + usage so the screen reflects it.
	useEffect(() => {
		if (status === "success") {
			void qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
			void qc.invalidateQueries({ queryKey: ["billing-usage", workspaceId] });
		}
	}, [status, qc, workspaceId]);

	const checkout = useMutation({
		mutationFn: (target: PaidPlan) => startCheckout(workspaceId!, target),
		onMutate: () => setError(null),
		onSuccess: (session) => void redirectToStripeCheckout(session),
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
	const selecting = checkout.isPending ? (checkout.variables ?? null) : null;

	return (
		<div className="mx-auto w-full max-w-[1040px] space-y-6 p-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ck-text">
					Billing &amp; usage
				</h1>
				<p className="text-sm text-ck-muted">
					One metered unit = one agent response. Metering is approximate today.
				</p>
			</header>

			{banner && <StatusBanner status={banner} />}
			{error && <BillingNotice message={error} />}

			{exempt && (
				<div className="rounded-[10px] border border-ck-accent-border bg-ck-accent-soft p-4 text-sm">
					<p className="font-semibold text-ck-text">
						Internal account — full access, no billing.
					</p>
					<p className="mt-1 text-ck-muted">
						This workspace is exempt from plan limits and isn&apos;t charged.
					</p>
				</div>
			)}

			{usageQ.data && (
				<div className="max-w-xl">
					<PlanUsageCard
						plan={plan}
						priceUsdMonthly={priceUsdMonthly}
						exempt={exempt}
						usage={usageQ.data.usage}
						entitlements={usageQ.data.entitlements}
						monthStartUnix={usageQ.data.monthStartUnix}
						isOwner={isOwner}
						managing={portal.isPending}
						onManage={() => portal.mutate()}
					/>
				</div>
			)}

			{!exempt && (
				<>
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ck-faint">
								Plans
							</span>
						</div>
						<PlanTiers
							currentPlan={plan}
							availablePlans={usageQ.data?.availablePlans}
							selecting={selecting}
							disabled={!isOwner || pending}
							onSelect={(target) => checkout.mutate(target)}
						/>
					</div>

					<div className="flex items-start gap-2.5 rounded-[10px] border border-ck-border bg-ck-chip p-4 text-sm text-ck-muted">
						<CreditCard className="mt-0.5 size-4 shrink-0" />
						<p>
							<span className="font-semibold text-ck-text">
								A card is required to start.
							</span>{" "}
							Every plan is paid — pick a tier and add a card to put your agent
							live. You&apos;re billed monthly and can change or cancel anytime.
							{!isOwner && " Only a workspace owner can manage billing."}
						</p>
					</div>
				</>
			)}
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
