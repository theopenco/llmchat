"use client";

import {
	FileText,
	Globe,
	MessagesSquare,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card } from "@/components/ds";
import {
	formatRelativeTime,
	SOURCE_URL_ERRORS,
	validateSourceUrl,
} from "@/lib/source-url";
import { cn } from "@/lib/utils";

import type { Source } from "../types";
import {
	STATUS_STYLE,
	sourceStatus,
	sourceType,
	type SourceType,
} from "./source-status";

const TYPE_ICON: Record<SourceType, typeof Globe> = {
	URL: Globe,
	"Q&A": MessagesSquare,
	Text: FileText,
};

function SourceRow({
	source,
	onRefresh,
	onDelete,
	refreshing,
}: {
	source: Source;
	onRefresh: (id: string) => void;
	onDelete: (id: string) => void;
	refreshing: boolean;
}) {
	const type = sourceType(source);
	const status = STATUS_STYLE[sourceStatus(source)];
	const Icon = TYPE_ICON[type];
	const promoted = source.kind === "qa";
	return (
		<div className="flex items-center gap-3 border-t border-ck-border px-4 py-3 first:border-t-0">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ck-chip text-ck-muted">
				<Icon className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-[13.5px] font-medium text-ck-text">
					{source.url ?? source.title}
				</p>
				{promoted ? (
					<p className="truncate text-[11px] font-medium text-ck-accent">
						Promoted from a reply
					</p>
				) : (
					source.url &&
					source.title && (
						<p className="truncate text-[11px] text-ck-faint">{source.title}</p>
					)
				)}
			</div>
			<Badge
				tone="neutral"
				className="hidden w-16 justify-center sm:inline-flex"
			>
				{type}
			</Badge>
			<span
				className={cn(
					"hidden w-[88px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold sm:inline-flex",
					status.className,
				)}
			>
				{status.label}
			</span>
			<span className="hidden w-20 text-right text-[11px] text-ck-faint md:inline">
				{formatRelativeTime(source.createdAt)}
			</span>
			<div className="flex shrink-0 items-center gap-1">
				{source.url && (
					<Button
						variant="ghost"
						size="icon"
						className="text-ck-faint hover:text-ck-text"
						onClick={() => onRefresh(source.id)}
						disabled={refreshing}
						aria-label={`Recrawl ${source.url}`}
					>
						<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="text-ck-faint hover:bg-ck-warn/10 hover:text-ck-warn"
					onClick={() => onDelete(source.id)}
					aria-label={`Delete ${source.url ?? source.title}`}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</div>
	);
}

export function SourcesPanel({
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
		const error = validateSourceUrl(value);
		if (error === "empty") return;
		if (error) {
			toast.error(SOURCE_URL_ERRORS[error]);
			return;
		}
		onAdd(value);
		setUrl("");
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Add a source — URL is LIVE; other types are honest roadmap. */}
			<div className="flex flex-col gap-2">
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
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
						className="h-10 flex-1 rounded-[10px] border border-ck-border bg-ck-card px-3 font-mono text-[13px] text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent"
					/>
					<Button
						onClick={submit}
						disabled={addPending || !url.trim()}
						className="shrink-0"
					>
						<Plus className="size-4" />
						{addPending ? "Adding…" : "Add source"}
					</Button>
				</div>
				{/* Roadmap — dimmed, not a working fake. No empty rollup cards. */}
				<p className="text-[11.5px] text-ck-faint">
					More source types — files, Q&amp;A import — coming. Q&amp;A sources
					are added today by promoting an inbox reply.
				</p>
			</div>

			{isLoading ? (
				<Card className="p-4">
					<div className="h-5 w-1/3 animate-pulse rounded bg-ck-chip" />
				</Card>
			) : sources.length === 0 ? (
				<Card className="flex flex-col items-center gap-2 border-dashed p-8 text-center">
					<span className="flex size-9 items-center justify-center rounded-[10px] bg-ck-chip text-ck-faint">
						<Globe className="size-4" />
					</span>
					<p className="text-sm font-semibold text-ck-text">No sources yet</p>
					<p className="text-xs text-ck-faint">
						Add a URL so your agent can answer from your content.
					</p>
				</Card>
			) : (
				<Card>
					{/* Column header (sm+). */}
					<div className="hidden items-center gap-3 border-b border-ck-border px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-ck-faint sm:flex">
						<span className="size-8 shrink-0" />
						<span className="flex-1">Source</span>
						<span className="w-16 text-center">Type</span>
						<span className="w-[88px] text-center">Status</span>
						<span className="hidden w-20 text-right md:inline">Added</span>
						<span className="w-[72px]" />
					</div>
					{sources.map((s) => (
						<SourceRow
							key={s.id}
							source={s}
							onRefresh={onRefresh}
							onDelete={onDelete}
							refreshing={refreshingId === s.id}
						/>
					))}
				</Card>
			)}
		</div>
	);
}
