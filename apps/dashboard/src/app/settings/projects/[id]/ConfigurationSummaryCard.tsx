"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigurationSummaryCard({
	modelName,
	brandColor,
	welcomeMessage,
	sourceCount,
	embedPath,
}: {
	modelName: string;
	brandColor: string;
	welcomeMessage: string;
	sourceCount: number;
	/** Path part of the embed URL, e.g. `/embed/pk_…` — kept short for layout. */
	embedPath: string;
}) {
	return (
		<Card className="rounded-2xl shadow-sm">
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Configuration summary</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="flex flex-col gap-3 text-sm">
					<div className="flex items-start justify-between gap-4">
						<dt className="text-muted-foreground">Model</dt>
						<dd className="min-w-0 truncate text-right font-medium text-foreground">
							{modelName}
						</dd>
					</div>
					<div className="flex items-center justify-between gap-4">
						<dt className="text-muted-foreground">Brand color</dt>
						<dd className="flex items-center gap-2 font-medium text-foreground">
							<span
								className="size-3.5 rounded-full border border-border"
								style={{ backgroundColor: brandColor || "#000000" }}
							/>
							<span className="font-mono text-xs">
								{brandColor || "#000000"}
							</span>
						</dd>
					</div>
					<div className="flex items-start justify-between gap-4">
						<dt className="shrink-0 text-muted-foreground">Welcome message</dt>
						<dd className="min-w-0 truncate text-right font-medium text-foreground">
							{welcomeMessage || "—"}
						</dd>
					</div>
					<div className="flex items-center justify-between gap-4">
						<dt className="text-muted-foreground">Sources</dt>
						<dd className="font-medium text-foreground">{sourceCount}</dd>
					</div>
					<div className="flex items-center justify-between gap-4">
						<dt className="shrink-0 text-muted-foreground">Embed URL</dt>
						<dd
							className="min-w-0 truncate text-right font-mono text-xs font-medium text-foreground"
							title={embedPath}
						>
							{embedPath}
						</dd>
					</div>
					<div className="flex items-center justify-between gap-4">
						<dt className="text-muted-foreground">Status</dt>
						<dd>
							<Badge
								variant="outline"
								className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
							>
								Draft
							</Badge>
						</dd>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}
