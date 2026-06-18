import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Usage this month. Only the project count is real (from the projects query);
 * per-message metering isn't surfaced yet, so we show the honest "coming soon"
 * notice instead of fabricating message totals or usage bars.
 */
export function UsageCard({ projectCount }: { projectCount: number | null }) {
	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle>Usage this month</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Projects</span>
					<span className="font-medium tabular-nums">
						{projectCount ?? "—"}
					</span>
				</div>

				<div className="mt-auto flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
					<Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div className="text-xs text-muted-foreground">
						<p className="font-medium text-foreground">
							Usage limits and billing enforcement are coming soon.
						</p>
						<p className="mt-1">
							We&apos;re building per-message usage tracking and limits so you
							can scale with confidence.
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
