import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/workspace-utils";

import { PRO_TIER } from "./billing-plans";

/**
 * The single hosted tier (Pro). With the free tier removed there's nothing to
 * compare against, so this renders one full-width card — no tier grid and no
 * "Most popular" badge (which would be meaningless with one option). Features
 * are capabilities only; usage limits are intentionally not listed.
 */
export function PricingTiers({
	currentPlan,
	pending,
	onUpgrade,
}: {
	currentPlan: Plan;
	pending: boolean;
	onUpgrade: () => void;
}) {
	const isCurrent = currentPlan === PRO_TIER.plan;

	return (
		<section className="rounded-2xl border bg-card p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h3 className="font-display text-lg font-semibold tracking-tight-display">
						{PRO_TIER.name}
					</h3>
					<div className="mt-2 flex items-baseline gap-1">
						<span className="text-3xl font-semibold tracking-tight-display">
							{PRO_TIER.price}
						</span>
						<span className="text-sm text-muted-foreground">/ month</span>
					</div>
					<p className="mt-1 text-sm text-muted-foreground">
						{PRO_TIER.tagline}
					</p>
				</div>
				<div className="w-full sm:w-auto">
					{isCurrent ? (
						<Button variant="outline" className="w-full sm:w-auto" disabled>
							Current plan
						</Button>
					) : (
						<Button
							className="w-full sm:w-auto"
							onClick={onUpgrade}
							disabled={pending}
						>
							{pending ? "Redirecting…" : "Upgrade to Pro"}
						</Button>
					)}
				</div>
			</div>

			<ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
				{PRO_TIER.features.map((f) => (
					<li key={f} className="flex items-start gap-2 text-sm">
						<Check className="mt-0.5 size-4 shrink-0 text-primary" />
						<span>{f}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
