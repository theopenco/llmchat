import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PaidPlan } from "@llmchat/shared";

import { TIERS } from "./billing-plans";

/**
 * The three paid tiers as a comparison grid. Presentational + reused: the
 * billing screen and the onboarding paywall both render it. No prices (shown at
 * Stripe Checkout); each card lists real entitlements and a single CTA.
 *
 * `currentPlan` marks the active tier as "Current plan"; every other tier gets
 * a "Choose <tier>" button wired to `onSelect`. When `disabled` (e.g. the
 * caller isn't a workspace owner) the CTAs are inert.
 */
export function TierGrid({
	currentPlan,
	selecting,
	disabled,
	onSelect,
	ctaPrefix = "Choose",
}: {
	currentPlan?: string;
	/** The plan whose CTA is mid-redirect (shows a pending label). */
	selecting?: PaidPlan | null;
	disabled?: boolean;
	onSelect: (plan: PaidPlan) => void;
	/** CTA verb — "Choose" on billing, "Start with" on the paywall. */
	ctaPrefix?: string;
}) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{TIERS.map((tier) => {
				const isCurrent = currentPlan === tier.plan;
				const pending = selecting === tier.plan;
				return (
					<section
						key={tier.plan}
						className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
							tier.highlight ? "border-primary shadow-sm" : ""
						}`}
					>
						{tier.highlight && (
							<Badge className="absolute -top-2.5 left-6">Most popular</Badge>
						)}
						<div>
							<h3 className="font-display text-lg font-semibold tracking-tight-display">
								{tier.name}
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{tier.tagline}
							</p>
						</div>

						<ul className="mt-5 flex-1 space-y-2.5">
							{tier.features.map((f) => (
								<li key={f} className="flex items-start gap-2 text-sm">
									<Check className="mt-0.5 size-4 shrink-0 text-primary" />
									<span>{f}</span>
								</li>
							))}
						</ul>

						<div className="mt-6">
							{isCurrent ? (
								<Button variant="outline" className="w-full" disabled>
									Current plan
								</Button>
							) : (
								<Button
									className="w-full"
									variant={tier.highlight ? "default" : "outline"}
									onClick={() => onSelect(tier.plan)}
									disabled={disabled || pending}
								>
									{pending ? "Redirecting…" : `${ctaPrefix} ${tier.name}`}
								</Button>
							)}
						</div>
					</section>
				);
			})}
		</div>
	);
}
