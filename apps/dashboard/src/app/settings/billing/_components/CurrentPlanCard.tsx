import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/workspace-utils";

import { PRICING_TIERS } from "./billing-plans";

/**
 * The caller's current plan: price, tagline, included features, and the
 * plan-driven action (free → upgrade, paid → manage in the Stripe portal).
 */
export function CurrentPlanCard({
	plan,
	pending,
	onUpgrade,
	onManage,
}: {
	plan: Plan;
	pending: boolean;
	onUpgrade: () => void;
	onManage: () => void;
}) {
	const tier = PRICING_TIERS.find((t) => t.plan === plan) ?? PRICING_TIERS[0];
	const isFree = plan === "free";

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Current plan</CardTitle>
					<Badge variant={isFree ? "secondary" : "success"}>{tier.name}</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				<div className="flex items-baseline gap-1">
					<span className="text-3xl font-semibold tracking-tight-display">
						{tier.price}
					</span>
					<span className="text-sm text-muted-foreground">/ month</span>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{isFree ? "Perfect for getting started." : tier.tagline}
				</p>

				<ul className="mt-5 flex flex-1 flex-col gap-2.5">
					{tier.features.map((f) => (
						<li key={f} className="flex items-start gap-2 text-sm">
							<Check className="mt-0.5 size-4 shrink-0 text-primary" />
							<span>{f}</span>
						</li>
					))}
				</ul>

				<div className="mt-6">
					{isFree ? (
						<Button className="w-full" onClick={onUpgrade} disabled={pending}>
							{pending ? "Redirecting…" : "Upgrade to Pro"}
						</Button>
					) : (
						<Button
							variant="outline"
							className="w-full"
							onClick={onManage}
							disabled={pending}
						>
							{pending ? "Redirecting…" : "Manage billing"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
