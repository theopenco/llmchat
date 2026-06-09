"use client";

import Link from "next/link";
import { ChevronLeft, Eye, FileText, Globe, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ProjectHeader({
	name,
	modelName,
	sourceCount,
	dirty,
	saving,
	onSave,
	onPreview,
}: {
	name: string;
	modelName: string;
	sourceCount: number;
	dirty: boolean;
	saving: boolean;
	onSave: () => void;
	onPreview: () => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0 space-y-1.5">
					<Link
						href="/settings/projects"
						className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						<ChevronLeft className="size-4" />
						Back to Projects
					</Link>
					<h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
						Configure &ldquo;{name}&rdquo;
					</h1>
					<p className="text-sm text-muted-foreground">
						Set up your AI chatbot before installing it on your website.
					</p>
					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Badge
							variant="outline"
							className="border-amber-200 bg-amber-50 text-amber-700"
						>
							Draft
						</Badge>
						<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
							<FileText className="size-3.5" />
							{modelName}
						</span>
						<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
							<Globe className="size-3.5" />
							{sourceCount} {sourceCount === 1 ? "source" : "sources"}
						</span>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-3">
					{dirty && (
						<span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex">
							<span className="size-2 rounded-full bg-amber-500" />
							Unsaved changes
						</span>
					)}
					<Button type="button" variant="outline" onClick={onPreview}>
						<Eye />
						Preview
					</Button>
					<Button type="button" onClick={onSave} disabled={!dirty || saving}>
						{saving && <Loader2 className="animate-spin" />}
						Save changes
					</Button>
				</div>
			</div>
		</div>
	);
}
