"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { BillingNotice } from "@/app/settings/billing/_components/BillingNotice";
import { TierGrid } from "@/app/settings/billing/_components/TierGrid";
import { BrandLogo } from "@/components/brand-logo";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import {
	fetchUsage,
	isBillingNotConfigured,
	redirectToStripeCheckout,
	startCheckout,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

import type { BillingInterval, PaidPlan } from "@llmchat/shared";

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
	// Billing cadence for checkout — toggled below, mirrors the billing screen.
	const [interval, setInterval] = useState<BillingInterval>("month");
	// Shares the billing-usage cache; only used here for availablePlans.
	const usageQ = useQuery({
		queryKey: ["billing-usage", workspaceId],
		queryFn: () => fetchUsage(workspaceId),
	});
	const checkout = useMutation({
		mutationFn: (plan: PaidPlan) =>
			// Cadence comes from the toggle; pass it (and returnTo) explicitly so the
			// Stripe session bills monthly/yearly and lands back on /onboarding.
			startCheckout(workspaceId, plan, interval, "/onboarding"),
		onMutate: () => setError(null),
		onSuccess: (session, plan) => {
			track(ANALYTICS_EVENTS.checkoutStarted, {
				plan,
				interval,
				source: "onboarding",
			});
			void redirectToStripeCheckout(session);
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
					get started. Billed monthly or yearly; change or cancel anytime.
				</p>
			</header>

			{error && (
				<div className="mx-auto mt-6 max-w-md">
					<BillingNotice message={error} />
				</div>
			)}

			{/* Cadence toggle. Annual gives two months free, same as the billing
			    screen — the price + saving render per-tier inside TierGrid. */}
			<div className="mt-8 flex justify-center">
				<div
					role="tablist"
					aria-label="Billing cadence"
					className="inline-flex items-center gap-1 rounded-full border bg-card p-1"
				>
					{(["month", "year"] as const).map((value) => {
						const active = interval === value;
						return (
							<button
								key={value}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setInterval(value)}
								className={cn(
									"rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
									active
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{value === "month" ? "Monthly" : "Annual"}
								{value === "year" && (
									<span
										className={cn(
											"ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]",
											active
												? "bg-white/20 text-primary-foreground"
												: "bg-primary/10 text-primary",
										)}
									>
										2 months free
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			<div className="mt-8">
				<TierGrid
					availablePlans={usageQ.data?.availablePlans}
					selecting={selecting}
					disabled={!canManage || checkout.isPending}
					onSelect={(plan) => checkout.mutate(plan)}
					ctaPrefix="Start with"
					interval={interval}
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
