"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { BillingNotice } from "@/app/settings/billing/_components/BillingNotice";
import { TierGrid } from "@/app/settings/billing/_components/TierGrid";
import { BrandLogo } from "@/components/brand-logo";
import { isBillingNotConfigured, startCheckout } from "@/lib/billing";

import type { PaidPlan } from "@llmchat/shared";

/**
 * Paywall shown before onboarding when the workspace has no active subscription
 * (paid-only product). Picking a tier starts Stripe Checkout and, on success,
 * returns the browser to /onboarding to build the agent. Reuses the same
 * TierGrid as the billing screen so the two never drift.
 */
export function OnboardingPaywall({
	workspaceId,
	canManage,
}: {
	workspaceId: string;
	canManage: boolean;
}) {
	const [error, setError] = useState<string | null>(null);
	const checkout = useMutation({
		mutationFn: (plan: PaidPlan) =>
			startCheckout(workspaceId, plan, "/onboarding"),
		onMutate: () => setError(null),
		onSuccess: (url) => {
			window.location.href = url;
		},
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
					put your support agent live. Billed monthly; change or cancel anytime.
				</p>
			</header>

			{error && (
				<div className="mx-auto mt-6 max-w-md">
					<BillingNotice message={error} />
				</div>
			)}

			<div className="mt-10">
				<TierGrid
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
