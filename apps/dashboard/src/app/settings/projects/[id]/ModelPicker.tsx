"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useMemo, useState } from "react";

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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface GatewayProvider {
	providerId: string;
}

interface GatewayModel {
	id: string;
	name: string;
	description?: string;
	family?: string;
	providers?: GatewayProvider[];
	supported_parameters?: string[];
}

interface GatewayResponse {
	data: GatewayModel[];
}

const GATEWAY_URL = "https://api.llmgateway.io/v1/models";

export const DEFAULT_MODEL = "gpt-4o-mini";
const ALL_FILTER = "all";

function hashString(value: string) {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

function modelColor(value: string) {
	const hash = hashString(value);
	const hue = hash % 360;
	const saturation = 62 + (hash % 22);
	const lightness = 42 + ((hash >> 4) % 14);

	return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function titleCase(value: string) {
	return value
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function familyLabel(family?: string) {
	return family ? titleCase(family) : "Other";
}

function providerIds(providers?: GatewayProvider[]) {
	return [...new Set(providers?.map((provider) => provider.providerId) ?? [])];
}

function providerLabel(providers?: GatewayProvider[]) {
	const ids = providerIds(providers);
	if (!ids.length) return "No provider";
	if (ids.length <= 2) return ids.map(titleCase).join(", ");
	return `${ids.slice(0, 2).map(titleCase).join(", ")} +${ids.length - 2}`;
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
}: {
	value: string;
	onChange: (id: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [providerFilter, setProviderFilter] = useState(ALL_FILTER);
	const modelsQ = useQuery({
		queryKey: ["gateway-models"],
		staleTime: 1000 * 60 * 30,
		queryFn: async (): Promise<GatewayModel[]> => {
			const res = await fetch(GATEWAY_URL);
			if (!res.ok) throw new Error(`Gateway ${res.status}`);
			const json = (await res.json()) as GatewayResponse;
			return json.data ?? [];
		},
	});

	const selectedModel = useMemo(() => {
		const selectedId = value || DEFAULT_MODEL;
		return modelsQ.data?.find((model) => model.id === selectedId);
	}, [modelsQ.data, value]);

	const providerOptions = useMemo(() => {
		const counts = new Map<string, number>();
		for (const model of modelsQ.data ?? []) {
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
	}, [modelsQ.data]);

	const filteredFamilies = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const map = new Map<string, GatewayModel[]>();

		for (const model of modelsQ.data ?? []) {
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
	}, [modelsQ.data, providerFilter, query]);

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
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
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
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[min(42rem,var(--radix-popover-trigger-width))] p-0"
			>
				<Command shouldFilter={false}>
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
					<CommandList className="max-h-80">
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
											<span className="truncate font-medium">{model.name}</span>
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
			</PopoverContent>
		</Popover>
	);
}
