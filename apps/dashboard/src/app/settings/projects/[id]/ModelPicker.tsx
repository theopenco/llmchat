"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface GatewayProvider {
	providerId: string;
	tools?: boolean;
	reasoning?: boolean;
	vision?: boolean;
	pricing?: { prompt?: string; completion?: string };
}

interface GatewayModel {
	id: string;
	name: string;
	description?: string;
	family?: string;
	context_length?: number;
	providers?: GatewayProvider[];
	architecture?: { input_modalities?: string[] };
	deprecated_at?: string;
	deactivated_at?: string;
}

interface GatewayResponse {
	data: GatewayModel[];
}

const GATEWAY_URL = "https://api.llmgateway.io/v1/models";

/** Default web-search model for new/unset projects. */
export const DEFAULT_WEB_SEARCH_MODEL = "gpt-4o-search-preview";

/**
 * Web-search-capable models on llmgateway: the Perplexity Sonar family
 * (online search built in) and OpenAI's *-search-preview models.
 */
function isWebSearchModel(m: GatewayModel): boolean {
	if (m.deactivated_at && new Date(m.deactivated_at) < new Date()) return false;
	if (m.family === "perplexity") return true;
	if (/search/i.test(m.id)) return true;
	return false;
}

const FAMILY_META: Record<
	string,
	{ label: string; dot: string; chip: string }
> = {
	perplexity: {
		label: "Perplexity",
		dot: "bg-teal-500",
		chip: "bg-teal-50 text-teal-700 ring-teal-100",
	},
	openai: {
		label: "OpenAI",
		dot: "bg-emerald-500",
		chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
	},
};

function familyMeta(family?: string) {
	return (
		FAMILY_META[family ?? ""] ?? {
			label: family ?? "Other",
			dot: "bg-gray-400",
			chip: "bg-gray-50 text-gray-600 ring-gray-100",
		}
	);
}

function formatPrice(model: GatewayModel): string | null {
	const p = model.providers?.[0]?.pricing?.prompt;
	if (!p) return null;
	const perToken = Number(p);
	if (!Number.isFinite(perToken) || perToken === 0) return null;
	const perMillion = perToken * 1_000_000;
	return `$${perMillion.toFixed(2)}/M`;
}

export function ModelPicker({
	value,
	onChange,
}: {
	value: string;
	onChange: (id: string) => void;
}) {
	const modelsQ = useQuery({
		queryKey: ["gateway-models"],
		staleTime: 1000 * 60 * 30,
		queryFn: async (): Promise<GatewayModel[]> => {
			const res = await fetch(GATEWAY_URL);
			if (!res.ok) throw new Error(`Gateway ${res.status}`);
			const json = (await res.json()) as GatewayResponse;
			return json.data.filter(isWebSearchModel);
		},
	});

	const models = useMemo(() => {
		const list = modelsQ.data ?? [];
		return [...list].sort((a, b) => {
			if (a.family !== b.family)
				return (a.family ?? "").localeCompare(b.family ?? "");
			return a.name.localeCompare(b.name);
		});
	}, [modelsQ.data]);

	const grouped = useMemo(() => {
		const map = new Map<string, GatewayModel[]>();
		for (const m of models) {
			const key = m.family ?? "other";
			const arr = map.get(key) ?? [];
			arr.push(m);
			map.set(key, arr);
		}
		return Array.from(map.entries());
	}, [models]);

	if (modelsQ.isLoading) {
		return <Skeleton className="h-10 w-full" />;
	}

	return (
		<Select
			value={value || DEFAULT_WEB_SEARCH_MODEL}
			onValueChange={onChange}
		>
			<SelectTrigger>
				<SelectValue placeholder="Select a web-search model…" />
			</SelectTrigger>
			<SelectContent>
				{grouped.map(([family, items]) => {
					const meta = familyMeta(family);
					return (
						<SelectGroup key={family}>
							<SelectLabel className="flex items-center gap-1.5">
								<Globe className="size-3 text-info" />
								{meta.label}
							</SelectLabel>
							{items.map((m) => {
								const price = formatPrice(m);
								return (
									<SelectItem key={m.id} value={m.id}>
										<span className="flex flex-col">
											<span className="flex items-center gap-2">
												<span className="font-medium">{m.name}</span>
												{price && (
													<Badge variant="secondary" className="font-mono">
														{price}
													</Badge>
												)}
											</span>
											<span className="font-mono text-[11px] text-muted-foreground">
												{m.id}
											</span>
										</span>
									</SelectItem>
								);
							})}
						</SelectGroup>
					);
				})}
			</SelectContent>
		</Select>
	);
}
