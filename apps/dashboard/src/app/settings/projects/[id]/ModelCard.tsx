"use client";

import { ChevronDown, Info, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ModelBadges } from "./ModelBadges";
import { ModelPicker } from "./ModelPicker";
import {
	DEFAULT_MODEL,
	formatContextLength,
	formatPricing,
	isWebSearchModel,
	modelColor,
	providerLabel,
	useGatewayModels,
} from "./model-data";
import { SectionCard } from "./SectionCard";

export function ModelCard({
	value,
	onChange,
}: {
	value: string;
	onChange: (id: string) => void;
}) {
	const modelsQ = useGatewayModels();
	const selectedId = value || DEFAULT_MODEL;
	const model = modelsQ.data?.find((m) => m.id === selectedId);
	// A saved model that's no longer a web-search model: the live bot already
	// falls back to the default, but the owner must pick a current one.
	const unavailable = Boolean(value) && !isWebSearchModel(value);

	return (
		<SectionCard
			id="model"
			step={2}
			title="AI model"
			description="Choose the AI model that will answer your visitors."
		>
			<div
				className={cn(
					"rounded-xl border p-4",
					unavailable ? "border-amber-500/40 bg-amber-500/5" : "border-border",
				)}
			>
				{modelsQ.isLoading ? (
					<Skeleton className="h-12 w-full" />
				) : (
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						{unavailable ? (
							<div className="flex min-w-0 items-start gap-3">
								<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
									<TriangleAlert className="size-3.5" />
								</span>
								<div className="min-w-0">
									<span className="font-semibold text-foreground">
										This model is no longer available
									</span>
									<p className="truncate font-mono text-xs text-muted-foreground">
										{value}
									</p>
									<p className="mt-1 text-xs text-amber-700 dark:text-amber-500">
										Pick a new model — visitors are currently answered by the
										default.
									</p>
								</div>
							</div>
						) : (
							<div className="flex min-w-0 items-start gap-3">
								<span
									className="mt-1.5 size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: modelColor(selectedId) }}
								/>
								<div className="min-w-0">
									<span className="truncate font-semibold text-foreground">
										{model?.name ?? selectedId}
									</span>
									<p className="truncate font-mono text-xs text-muted-foreground">
										{model?.id ?? selectedId}
									</p>
									<p className="mt-1 truncate text-xs text-muted-foreground">
										{model
											? [
													providerLabel(model.providers),
													formatContextLength(model) &&
														`${formatContextLength(model)} ctx`,
													formatPricing(model),
												]
													.filter(Boolean)
													.join(" · ")
											: "Selected model"}
									</p>
									{model && <ModelBadges model={model} className="mt-1.5" />}
								</div>
							</div>
						)}

						<ModelPicker
							value={value}
							onChange={onChange}
							trigger={
								<Button
									type="button"
									variant={unavailable ? "default" : "outline"}
									className="shrink-0"
								>
									{unavailable ? "Pick a model" : "Change model"}
									<ChevronDown />
								</Button>
							}
						/>
					</div>
				)}
			</div>

			<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Info className="size-3.5" />
				Only models with web search are listed.
			</p>
		</SectionCard>
	);
}
