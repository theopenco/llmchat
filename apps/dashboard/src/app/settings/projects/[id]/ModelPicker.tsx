"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { ModelBadges } from "./ModelBadges";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	DEFAULT_MODEL,
	formatContextLength,
	formatPricing,
	type GatewayModel,
	modelColor,
	providerIds,
	providerLabel,
	titleCase,
	useGatewayModels,
	webSearchModels,
} from "./model-data";

export { DEFAULT_MODEL };

// Hoisted fallback so `pool` is referentially stable when the query is empty
// (an inline `?? []` would invalidate the useMemos below on every render).
const NO_MODELS: GatewayModel[] = [];

function familyLabel(family?: string) {
	return family ? titleCase(family) : "Other";
}

function modelSearchText(model: GatewayModel) {
	return [
		model.id,
		model.name,
		model.description,
		model.family,
		...(model.supported_parameters ?? []),
		...providerIds(model.providers),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

export function ModelPicker({
	value,
	onChange,
	trigger,
}: {
	value: string;
	onChange: (id: string) => void;
	/** Custom trigger element; defaults to a full-width combobox button. */
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const modelsQ = useGatewayModels();

	// Only web-search-capable models are selectable here.
	const pool = useMemo(
		() => webSearchModels(modelsQ.data ?? NO_MODELS),
		[modelsQ.data],
	);

	const selectedModel = useMemo(() => {
		const selectedId = value || DEFAULT_MODEL;
		return (modelsQ.data ?? []).find((model) => model.id === selectedId);
	}, [modelsQ.data, value]);

	const filteredFamilies = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const map = new Map<string, GatewayModel[]>();
		for (const model of pool) {
			if (needle && !modelSearchText(model).includes(needle)) {
				continue;
			}
			const family = model.family ?? "other";
			const items = map.get(family) ?? [];
			items.push(model);
			map.set(family, items);
		}
		return Array.from(map.entries())
			.map(([family, items]) => ({
				family,
				label: familyLabel(family),
				items: items.toSorted((a, b) => a.name.localeCompare(b.name)),
			}))
			.toSorted((a, b) => a.label.localeCompare(b.label));
	}, [pool, query]);

	if (modelsQ.isLoading) {
		return <Skeleton className="h-10 w-full" />;
	}

	if (modelsQ.isError) {
		return (
			<div className="rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive">
				Could not load models.
			</div>
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button
						type="button"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="h-auto min-h-10 w-full justify-between px-3 py-2"
					>
						<span className="flex min-w-0 items-center gap-2">
							<span
								className="size-2.5 shrink-0 rounded-full"
								style={{
									backgroundColor: modelColor(selectedModel?.id ?? value),
								}}
							/>
							<span className="min-w-0 text-left">
								<span className="block truncate">
									{(selectedModel?.name ?? value) || "Select a model"}
								</span>
								{selectedModel && (
									<span className="block truncate font-mono text-xs font-normal text-muted-foreground">
										{selectedModel.id}
									</span>
								)}
							</span>
						</span>
						<ChevronsUpDown className="opacity-50" />
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="border-b px-4 py-3 text-left">
					<DialogTitle>Choose a model</DialogTitle>
					<DialogDescription>
						Web-search models available on LLM Gateway.
					</DialogDescription>
				</DialogHeader>
				<Command shouldFilter={false} className="rounded-none">
					<CommandInput
						value={query}
						onValueChange={setQuery}
						placeholder="Search model, provider, or family..."
					/>
					<CommandList className="max-h-[55vh]">
						{filteredFamilies.length === 0 && (
							<CommandEmpty>No models found.</CommandEmpty>
						)}
						{filteredFamilies.map(({ family, label, items }) => (
							<CommandGroup key={family} heading={label}>
								{items.map((model) => (
									<CommandItem
										key={model.id}
										value={model.id}
										onSelect={() => {
											onChange(model.id);
											setQuery("");
											setOpen(false);
										}}
										className="items-start py-2"
									>
										<span
											className="mt-1 size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: modelColor(model.id) }}
										/>
										<span className="flex min-w-0 flex-1 flex-col gap-1">
											<span className="truncate font-medium">{model.name}</span>
											<span className="truncate font-mono text-xs text-muted-foreground">
												{model.id}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{[
													providerLabel(model.providers),
													formatContextLength(model) &&
														`${formatContextLength(model)} ctx`,
													formatPricing(model),
												]
													.filter(Boolean)
													.join(" · ")}
											</span>
											<ModelBadges model={model} className="mt-0.5" />
										</span>
										<Check
											className={cn(
												"mt-1 opacity-0",
												model.id === (value || DEFAULT_MODEL) && "opacity-100",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
