"use client";

import { ChevronDown, Globe, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelPicker } from "./ModelPicker";
import {
	DEFAULT_MODEL,
	hasWebSearch,
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
	const webSearch = model ? hasWebSearch(model) : false;

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
								<div className="flex flex-wrap items-center gap-2">
									<span className="truncate font-semibold text-foreground">
										{model?.name ?? selectedId}
									</span>
									{webSearch && (
										<Badge
											variant="secondary"
											className="gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
										>
											<Globe className="size-3" />
											Web search
										</Badge>
									)}
								</div>
								<p className="truncate font-mono text-xs text-muted-foreground">
									{model?.id ?? selectedId}
								</p>
								<p className="mt-1 truncate text-xs text-muted-foreground">
									{model
										? [
												providerLabel(model.providers),
												webSearch && "Web search",
											]
												.filter(Boolean)
												.join(" · ")
										: "Selected model"}
								</p>
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
				All models available on LLM Gateway are listed.
			</p>
		</SectionCard>
	);
}
