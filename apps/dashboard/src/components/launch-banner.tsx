"use client";

import { useQuery } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { fetchUsage } from "@/lib/billing";
import { useWorkspace } from "@/lib/workspace";

import { isPaidPlan } from "@llmchat/shared";

/**
 * Build-first-then-pay nudge. A workspace can build its agent without paying,
 * but the live agent serves nothing until there's an active subscription
 * (enforced server-side on /v1/chat). This banner is the visible counterpart —
 * shown across the dashboard while the active workspace has no active plan and
 * isn't an exempt internal account. Hidden on the billing page itself.
 *
 * Shares the ["billing-usage", workspaceId] query cache with the billing page,
 * so it reflects an upgrade immediately and adds no extra request.
 */
export function LaunchBanner() {
	const { workspaceId } = useWorkspace();
	const pathname = usePathname();
	const { data } = useQuery({
		queryKey: ["billing-usage", workspaceId],
		enabled: !!workspaceId,
		queryFn: () => fetchUsage(workspaceId!),
	});

	if (!data || data.exempt || isPaidPlan(data.plan)) return null;
	if (pathname?.startsWith("/settings/billing")) return null;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
			<div className="flex items-center gap-2">
				<Rocket className="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
				<span className="text-muted-foreground">
					<span className="font-medium text-foreground">
						Your agent isn’t live yet.
					</span>{" "}
					Choose a plan to launch it — visitors can’t chat until you subscribe.
				</span>
			</div>
			<Button asChild size="sm">
				<Link href="/settings/billing">Choose a plan</Link>
			</Button>
		</div>
	);
}
