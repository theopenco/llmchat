"use client";

import { Check, ChevronsUpDown, Globe, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
	type GatewayModel,
	hasWebSearch,
	modelColor,
	providerIds,
	providerLabel,
	titleCase,
	useGatewayModels,
} from "./model-data";

export { DEFAULT_MODEL };

const ALL_FILTER = "all";

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

function filterButtonClassName(active: boolean) {
	return cn(
		"h-7 shrink-0 rounded-full px-2.5 text-xs",
		active &&
			"border-primary bg-primary text-primary-foreground hover:bg-primary/90",
	);
}

export function ModelPicker({
	value,
	onChange,
	webSearchOnly = false,
	trigger,
}: {
	value: string;
	onChange: (id: string) => void;
	/** Restrict the list to models that support web search (falls back to all if none match). */
	webSearchOnly?: boolean;
	/** Custom trigger element; defaults to a full-width combobox button. */
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [providerFilter, setProviderFilter] = useState(ALL_FILTER);
	const modelsQ = useGatewayModels();

	// Apply the web-search constraint up front, but never strand the user with
	// an empty list if the heuristic matches nothing.
	const pool = useMemo(() => {
		const all = modelsQ.data ?? [];
		if (!webSearchOnly) return all;
		const ws = all.filter(hasWebSearch);
		return ws.length ? ws : all;
	}, [modelsQ.data, webSearchOnly]);

	const selectedModel = useMemo(() => {
		const selectedId = value || DEFAULT_MODEL;
		return (modelsQ.data ?? []).find((model) => model.id === selectedId);
	}, [modelsQ.data, value]);

	const providerOptions = useMemo(() => {
		const counts = new Map<string, number>();
		for (const model of pool) {
			for (const provider of providerIds(model.providers)) {
				counts.set(provider, (counts.get(provider) ?? 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.map(([provider, count]) => ({
				value: provider,
				label: titleCase(provider),
				count,
			}))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
	}, [pool]);

	const filteredFamilies = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const map = new Map<string, GatewayModel[]>();
		for (const model of pool) {
			const providers = providerIds(model.providers);
			if (
				providerFilter !== ALL_FILTER &&
				!providers.includes(providerFilter)
			) {
				continue;
			}
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
				items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [pool, providerFilter, query]);

	const hasFilters = query.trim().length > 0 || providerFilter !== ALL_FILTER;

	function clearFilters() {
		setQuery("");
		setProviderFilter(ALL_FILTER);
	}

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
						All models available on LLM Gateway.
					</DialogDescription>
				</DialogHeader>
				<Command shouldFilter={false} className="rounded-none">
					<CommandInput
						value={query}
						onValueChange={setQuery}
						placeholder="Search model, provider, or family..."
					/>
					<div className="flex flex-col gap-2 border-b p-3">
						<div className="flex items-center justify-between gap-3">
							<span className="text-xs font-medium text-muted-foreground">
								Providers
							</span>
							{hasFilters && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={clearFilters}
								>
									<X />
									Clear
								</Button>
							)}
						</div>
						<div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className={filterButtonClassName(providerFilter === ALL_FILTER)}
								onClick={() => setProviderFilter(ALL_FILTER)}
							>
								All
							</Button>
							{providerOptions.map((provider) => (
								<Button
									key={provider.value}
									type="button"
									variant="outline"
									size="sm"
									className={filterButtonClassName(
										providerFilter === provider.value,
									)}
									onClick={() => setProviderFilter(provider.value)}
								>
									{provider.label}
									<span className="font-mono opacity-70">{provider.count}</span>
								</Button>
							))}
						</div>
					</div>
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
										<span className="flex min-w-0 flex-1 flex-col gap-0.5">
											<span className="flex items-center gap-2">
												<span className="truncate font-medium">
													{model.name}
												</span>
												{hasWebSearch(model) && (
													<Badge
														variant="secondary"
														className="gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
													>
														<Globe className="size-3" />
														Web search
													</Badge>
												)}
											</span>
											<span className="truncate font-mono text-xs text-muted-foreground">
												{model.id}
											</span>
											<span className="truncate text-xs text-muted-foreground">
												{providerLabel(model.providers)}
											</span>
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
