"use client";

import { ChevronDown, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelBadges } from "./ModelBadges";
import { ModelPicker } from "./ModelPicker";
import {
	DEFAULT_MODEL,
	formatContextLength,
	formatPricing,
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

	return (
		<SectionCard
			id="model"
			step={2}
			title="AI model"
			description="Choose the AI model that will answer your visitors."
		>
			<div className="rounded-xl border border-border p-4">
				{modelsQ.isLoading ? (
					<Skeleton className="h-12 w-full" />
				) : (
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

						<ModelPicker
							value={value}
							onChange={onChange}
							trigger={
								<Button type="button" variant="outline" className="shrink-0">
									Change model
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
