"use client";

import { Pin, Settings, Star, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge, Button, Card, CopyButton } from "@/components/ds";
import { cn } from "@/lib/utils";

import type { ProjectListItem } from "./types";

export interface ProjectCardProps {
	project: ProjectListItem;
	/** Responses in the last 30 days (lazy-loaded). `undefined` → still loading,
	 * render an honest "—", never a fabricated 0. */
	responses30d?: number;
	onToggleFavorite: (id: string, next: boolean) => void;
	onTogglePin: (id: string, next: boolean) => void;
	onDelete: (id: string) => void;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

export function ProjectCard({
	project,
	responses30d,
	onToggleFavorite,
	onTogglePin,
	onDelete,
}: ProjectCardProps) {
	const brand = project.brandColor || "#6366f1";
	return (
		<Card className="flex flex-col p-5 transition-colors hover:border-ck-accent/50">
			<div className="flex items-start gap-3">
				<span
					className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold text-white"
					style={{ backgroundColor: brand }}
				>
					{initial(project.name)}
				</span>
				<h3 className="min-w-0 flex-1 truncate pt-1.5 text-[15px] font-bold text-ck-text">
					{project.name}
				</h3>
				<div className="flex shrink-0 items-center">
					<Button
						variant="ghost"
						size="icon"
						className={cn(project.favorite ? "text-ck-warn" : "text-ck-faint")}
						onClick={() => onToggleFavorite(project.id, !project.favorite)}
						aria-label={project.favorite ? "Unfavorite" : "Favorite"}
					>
						<Star
							className={cn("size-4", project.favorite && "fill-current")}
						/>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className={cn(project.pinned ? "text-ck-text" : "text-ck-faint")}
						onClick={() => onTogglePin(project.id, !project.pinned)}
						aria-label={project.pinned ? "Unpin" : "Pin"}
					>
						<Pin className={cn("size-4", project.pinned && "fill-current")} />
					</Button>
				</div>
			</div>

			{/* Public key — public + safe to expose; with a real copy affordance. */}
			<div className="mt-3 flex items-center gap-2 rounded-[10px] border border-ck-border bg-ck-app px-2.5 py-1.5">
				<span className="text-[10px] font-bold uppercase tracking-wide text-ck-faint">
					Key
				</span>
				<span className="min-w-0 flex-1 truncate font-mono text-xs text-ck-muted">
					{project.publicKey}
				</span>
				<CopyButton
					value={project.publicKey}
					aria-label="Copy public key"
					className="size-7 shrink-0 text-ck-faint hover:text-ck-text"
				/>
			</div>

			<div className="my-3.5 h-px bg-ck-border" />

			<div className="flex items-center justify-between gap-2">
				<div>
					<div className="font-mono text-[15px] font-extrabold text-ck-text tabular-nums">
						{responses30d === undefined
							? "—"
							: responses30d.toLocaleString("en-US")}
					</div>
					<div className="text-[10.5px] text-ck-faint">responses · 30d</div>
				</div>
				<div className="flex items-center gap-2">
					<Badge tone="neutral" className="font-mono">
						{project.model}
					</Badge>
					<Button asChild variant="outline" size="icon" aria-label="Configure">
						<Link href={`/settings/projects/${project.id}`}>
							<Settings className="size-4" />
						</Link>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="text-ck-faint hover:bg-ck-warn/10 hover:text-ck-warn"
						onClick={() => onDelete(project.id)}
						aria-label="Delete project"
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			</div>
		</Card>
	);
}
