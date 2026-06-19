"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BillingNotice } from "@/app/settings/billing/_components/BillingNotice";
import { TierGrid } from "@/app/settings/billing/_components/TierGrid";
import { BrandLogo } from "@/components/brand-logo";
import {
	fetchUsage,
	isBillingNotConfigured,
	redirectToStripeCheckout,
	startCheckout,
} from "@/lib/billing";

import type { PaidPlan } from "@llmchat/shared";

/**
 * Hard paywall shown before onboarding when the workspace has no active
 * subscription (paid-only). Picking a tier starts Stripe Checkout and, on
 * success, returns to /onboarding to build the agent. Reuses the same TierGrid
 * as the billing screen — same real prices, same "coming soon" gating — so the
 * two never drift. This is the UX gate; building is also blocked server-side
 * (POST /api/projects → 402 subscription_required), so it can't be bypassed.
 */
export function OnboardingPaywall({
	workspaceId,
	canManage,
}: {
	workspaceId: string;
	canManage: boolean;
}) {
	const [error, setError] = useState<string | null>(null);
	// Shares the billing-usage cache; only used here for availablePlans.
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		queryFn: () => fetchUsage(workspaceId),
	});
	const checkout = useMutation({
		mutationFn: (plan: PaidPlan) =>
			startCheckout(workspaceId, plan, "/onboarding"),
		onMutate: () => setError(null),
		onSuccess: (session) => void redirectToStripeCheckout(session),
		onError: (e) =>
			setError(
				isBillingNotConfigured(e)
					? "Billing isn't enabled yet — check back soon."
					: "Something went wrong. Please try again in a moment.",
			),
	});
	const selecting = checkout.isPending ? (checkout.variables ?? null) : null;

	return (
		<div className="mx-auto w-full max-w-5xl">
			<header className="flex flex-col items-center gap-3 text-center">
				<BrandLogo className="size-11" />
				<h1 className="font-display text-3xl font-semibold tracking-tight-display">
					Choose a plan to launch your agent
				</h1>
				<p className="max-w-lg text-balance text-sm text-muted-foreground">
					Clanker Support is paid from day one — pick a plan and add a card to
					get started. Billed monthly; change or cancel anytime.
				</p>
			</header>

			{error && (
				<div className="mx-auto mt-6 max-w-md">
					<BillingNotice message={error} />
				</div>
			)}

			<div className="mt-10">
				<TierGrid
					availablePlans={usageQ.data?.availablePlans}
					selecting={selecting}
					disabled={!canManage || checkout.isPending}
					onSelect={(plan) => checkout.mutate(plan)}
					ctaPrefix="Start with"
				/>
			</div>

			{!canManage && (
				<p className="mt-6 text-center text-sm text-muted-foreground">
					Only a workspace owner can set up billing. Ask an owner to choose a
					plan.
				</p>
			)}
		</div>
	);
}
