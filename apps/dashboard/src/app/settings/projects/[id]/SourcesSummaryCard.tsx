"use client";

import { ArrowRight, Globe } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { SectionCard } from "./SectionCard";

/**
 * Config-page bridge for Sources (#92). The standalone Sources page
 * (/settings/projects/[id]/sources) is the single owner of add/list; this card
 * is a count-only summary + link. It keeps the `id="sources"` anchor and the
 * setup-progress "Sources added" step intact during the decomposition, with no
 * duplicate add UI. Retired when the config page becomes Settings tabs (#93).
 */
export function SourcesSummaryCard({
	projectId,
	sourceCount,
	isLoading,
}: {
	projectId: string;
	sourceCount: number;
	isLoading: boolean;
}) {
	return (
		<SectionCard
			id="sources"
			step={4}
			title="Sources"
			description="Content your support agent retrieves answers from."
		>
			<div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
				<div className="flex items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
						<Globe className="size-4" />
					</span>
					<div>
						<p className="text-sm font-medium text-foreground">
							{isLoading
								? "Loading sources…"
								: sourceCount === 0
									? "No sources yet"
									: `${sourceCount} source${sourceCount === 1 ? "" : "s"} connected`}
						</p>
						<p className="text-xs text-muted-foreground">
							Add, recrawl, or remove sources on the Sources page.
						</p>
					</div>
				</div>
				<Button asChild variant="outline" className="shrink-0">
					<Link href={`/settings/projects/${projectId}/sources`}>
						Manage sources
						<ArrowRight />
					</Link>
				</Button>
			</div>
		</SectionCard>
	);
}
