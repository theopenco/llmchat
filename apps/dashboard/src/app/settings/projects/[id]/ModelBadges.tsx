"use client";

import { Brain, Eye, Globe, TriangleAlert, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
	type GatewayModel,
	hasWebSearch,
	isDeactivated,
	isDeprecated,
	modelCapabilities,
} from "./model-data";

const WEB_SEARCH_CLASS =
	"gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";

/**
 * Capability badges rendered straight from the gateway's metadata — shared by
 * the model picker rows and the selected-model card so the two never drift.
 * Only badges backed by a real flag are shown; nothing is inferred.
 */
export function ModelBadges({
	model,
	className,
}: {
	model: GatewayModel;
	className?: string;
}) {
	const caps = modelCapabilities(model);
	return (
		<span className={cn("flex flex-wrap items-center gap-1", className)}>
			{hasWebSearch(model) && (
				<Badge variant="secondary" className={WEB_SEARCH_CLASS}>
					<Globe className="size-3" />
					Web search
				</Badge>
			)}
			{caps.vision && (
				<Badge variant="secondary" className="gap-1">
					<Eye className="size-3" />
					Vision
				</Badge>
			)}
			{caps.reasoning && (
				<Badge variant="secondary" className="gap-1">
					<Brain className="size-3" />
					Reasoning
				</Badge>
			)}
			{caps.tools && (
				<Badge variant="secondary" className="gap-1">
					<Wrench className="size-3" />
					Tools
				</Badge>
			)}
			{isDeactivated(model) ? (
				<Badge variant="destructive" className="gap-1">
					<TriangleAlert className="size-3" />
					Deactivated
				</Badge>
			) : (
				isDeprecated(model) && (
					<Badge
						variant="secondary"
						className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
					>
						<TriangleAlert className="size-3" />
						Deprecated
					</Badge>
				)
			)}
		</span>
	);
}
