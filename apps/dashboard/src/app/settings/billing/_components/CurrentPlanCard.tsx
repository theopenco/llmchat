import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/workspace-utils";

import { PRO_TIER } from "./billing-plans";

/**
 * The caller's billing status. There is no free tier any more, so a workspace
 * that isn't on a paid plan shows "No active subscription" (never a "$0 Free
 * plan"), and the action follows the status: not subscribed → upgrade, paid →
 * manage in the Stripe portal. Capabilities live on the Pro card below, so this
 * card stays lean — status + price + one action.
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
	const subscribed = plan !== "free";

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Current plan</CardTitle>
					<Badge variant={subscribed ? "success" : "secondary"}>
						{subscribed ? PRO_TIER.name : "No subscription"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col">
				{subscribed ? (
					<>
						<div className="flex items-baseline gap-1">
							<span className="text-3xl font-semibold tracking-tight-display">
								{plan === "pro" ? PRO_TIER.price : ""}
							</span>
							{plan === "pro" && (
								<span className="text-sm text-muted-foreground">/ month</span>
							)}
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{PRO_TIER.tagline}
						</p>
					</>
				) : (
					<p className="text-sm text-muted-foreground">
						You&apos;re not on a paid plan — nothing is being billed yet.
					</p>
				)}

				<div className="mt-auto pt-6">
					{subscribed ? (
						<Button
							variant="outline"
							className="w-full"
							onClick={onManage}
							disabled={pending}
						>
							{pending ? "Redirecting…" : "Manage billing"}
						</Button>
					) : (
						<Button className="w-full" onClick={onUpgrade} disabled={pending}>
							{pending ? "Redirecting…" : "Upgrade to Pro"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
