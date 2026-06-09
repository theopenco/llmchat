"use client";

import { useState } from "react";
import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import type { Source } from "./types";

function formatRelative(iso: string | null): string {
	if (!iso) return "never";
	const diff = Date.now() - new Date(iso).getTime();
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

function sourceStatus(s: Source): {
	label: string;
	className: string;
	indexed?: string;
} {
	if (s.lastError) {
		return {
			label: "Failed",
			className:
				"border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
		};
	}
	if (!s.active) {
		return {
			label: "Off",
			className: "border-border bg-muted text-muted-foreground",
		};
	}
	if (!s.lastFetchedAt) {
		return {
			label: "Pending",
			className:
				"border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
		};
	}
	return {
		label: "Ready",
		className:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
		indexed: `Indexed ${formatRelative(s.lastFetchedAt)}`,
	};
}

export function SourcesCard({
	sources,
	isLoading,
	onAdd,
	onRefresh,
	onDelete,
	addPending,
	refreshingId,
}: {
	sources: Source[];
	isLoading: boolean;
	onAdd: (url: string) => void;
	onRefresh: (id: string) => void;
	onDelete: (id: string) => void;
	addPending: boolean;
	refreshingId: string | null;
}) {
	const [url, setUrl] = useState("");

	function submit() {
		const value = url.trim();
		if (!value) return;
		try {
			new URL(value);
		} catch {
			toast.error("Enter a valid URL (include https://)");
			return;
		}
		onAdd(value);
		setUrl("");
	}

	return (
		<SectionCard
			id="sources"
			step={4}
			title="Sources"
			description="Add website URLs your chatbot should use to answer questions."
		>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							submit();
						}
					}}
					placeholder="https://example.com"
					aria-label="Source URL"
				/>
				<Button
					type="button"
					onClick={submit}
					disabled={addPending || !url.trim()}
					className="shrink-0"
				>
					<Plus />
					{addPending ? "Adding…" : "Add source"}
				</Button>
			</div>

			{isLoading ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			) : sources.length === 0 ? (
				<Empty className="rounded-xl border border-dashed border-border py-10">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Globe />
						</EmptyMedia>
						<EmptyTitle>No sources yet</EmptyTitle>
						<EmptyDescription>
							Add your website URL so your chatbot can answer based on your
							content.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								document
									.querySelector<HTMLInputElement>('[aria-label="Source URL"]')
									?.focus()
							}
						>
							<Plus />
							Add first source
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<ul className="flex flex-col gap-2">
					{sources.map((s) => {
						const status = sourceStatus(s);
						const refreshing = refreshingId === s.id;
						return (
							<li
								key={s.id}
								className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
									<Globe className="size-4" />
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-foreground">
										{s.url}
									</p>
									{s.title && (
										<p className="truncate text-xs text-muted-foreground">
											{s.title}
										</p>
									)}
								</div>
								<Badge
									variant="outline"
									className={cn("shrink-0", status.className)}
								>
									{status.label}
								</Badge>
								{status.indexed && (
									<span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
										{status.indexed}
									</span>
								)}
								<div className="flex shrink-0 items-center gap-1">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8 text-muted-foreground hover:text-foreground"
										onClick={() => onRefresh(s.id)}
										disabled={refreshing}
										aria-label={`Recrawl ${s.url}`}
										title="Recrawl"
									>
										<RefreshCw className={cn(refreshing && "animate-spin")} />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
										onClick={() => onDelete(s.id)}
										aria-label={`Delete ${s.url}`}
										title="Delete"
									>
										<Trash2 />
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<p className="text-xs text-muted-foreground">
				Add more sources to improve your chatbot&apos;s knowledge.
			</p>
		</SectionCard>
	);
}
