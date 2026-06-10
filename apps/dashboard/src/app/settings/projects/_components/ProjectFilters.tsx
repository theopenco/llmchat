"use client";

import { Search, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import type { ProjectSortMode } from "./types";

export interface ProjectFiltersProps {
	search: string;
	onSearchChange: (value: string) => void;
	favOnly: boolean;
	onFavOnlyChange: (value: boolean) => void;
	sort: ProjectSortMode;
	onSortChange: (value: ProjectSortMode) => void;
}

export function ProjectFilters({
	search,
	onSearchChange,
	favOnly,
	onFavOnlyChange,
	sort,
	onSortChange,
}: ProjectFiltersProps) {
	return (
		<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
			<div className="relative flex-1">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder="Search projects, model, key…"
					className="pl-9"
				/>
				{search && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onSearchChange("")}
						className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
						title="Clear"
					>
						<X />
					</Button>
				)}
			</div>
			<Toggle
				variant="outline"
				size="lg"
				pressed={favOnly}
				onPressedChange={onFavOnlyChange}
				title="Show favorites only"
				className={cn(
					favOnly && "text-warning border-warning/30 bg-warning/10",
				)}
			>
				<Star className={cn(favOnly && "fill-warning text-warning")} />
				Favorites
			</Toggle>
			<Select
				value={sort}
				onValueChange={(v) => onSortChange(v as ProjectSortMode)}
			>
				<SelectTrigger className="w-auto min-w-36">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectItem value="recent">Newest</SelectItem>
						<SelectItem value="name">Name (A–Z)</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
