"use client";

import { Pin, Settings, Star, Trash2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "./types";

export interface ProjectCardProps {
	project: ProjectListItem;
	onToggleFavorite: (id: string, next: boolean) => void;
	onTogglePin: (id: string, next: boolean) => void;
	onDelete: (id: string) => void;
}

export function ProjectCard({
	project,
	onToggleFavorite,
	onTogglePin,
	onDelete,
}: ProjectCardProps) {
	return (
		<Card className="group relative flex flex-col p-5 transition-all hover:border-foreground/15 hover:shadow-md">
			<div className="mb-4 flex items-start justify-between">
				<div
					className="h-2 w-10 rounded-full"
					style={{ backgroundColor: project.brandColor || "#000" }}
				/>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"size-8",
							project.favorite
								? "text-warning hover:text-warning"
								: "text-muted-foreground/50",
						)}
						onClick={() => onToggleFavorite(project.id, !project.favorite)}
						title={project.favorite ? "Unfavorite" : "Favorite"}
					>
						<Star className={cn(project.favorite && "fill-warning")} />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className={cn(
							"size-8",
							project.pinned ? "text-foreground" : "text-muted-foreground/50",
						)}
						onClick={() => onTogglePin(project.id, !project.pinned)}
						title={project.pinned ? "Unpin" : "Pin"}
					>
						<Pin className={cn(project.pinned && "fill-current")} />
					</Button>
				</div>
			</div>
			<h3 className="text-base font-semibold">{project.name}</h3>
			<p className="mt-1 font-mono text-xs text-muted-foreground">
				{project.publicKey.slice(0, 20)}…
			</p>
			<div className="mt-3 flex items-center gap-2">
				<Badge variant="secondary">{project.model}</Badge>
			</div>
			<div className="mt-auto flex items-center gap-2 pt-5">
				<Button asChild variant="outline" className="flex-1">
					<Link href={`/settings/projects/${project.id}`}>
						<Settings />
						Configure
					</Link>
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={() => onDelete(project.id)}
					className="border-destructive/20 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					title="Delete project"
				>
					<Trash2 />
				</Button>
			</div>
		</Card>
	);
}
