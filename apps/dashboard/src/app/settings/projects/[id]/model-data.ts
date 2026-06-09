"use client";

import { useQuery } from "@tanstack/react-query";

export interface GatewayProvider {
	providerId: string;
}

export interface GatewayModel {
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

/** Shared react-query hook so the picker and the model card don't double-fetch. */
export function useGatewayModels() {
	return useQuery({
		queryKey: ["gateway-models"],
		staleTime: 1000 * 60 * 30,
		queryFn: async (): Promise<GatewayModel[]> => {
			const res = await fetch(GATEWAY_URL);
			if (!res.ok) throw new Error(`Gateway ${res.status}`);
			const json = (await res.json()) as GatewayResponse;
			return json.data ?? [];
		},
	});
}

/**
 * Best-effort web-search capability detection from the fields the gateway
 * actually returns — never invents data. Matches an explicit
 * `web_search`-style supported parameter, or well-known web-search model
 * naming (search-preview, perplexity sonar, OpenRouter `:online`, …).
 */
export function hasWebSearch(model: GatewayModel): boolean {
	const params = model.supported_parameters ?? [];
	if (params.some((p) => /web[\s_-]?search/i.test(p))) return true;
	const hay = `${model.id} ${model.name} ${model.family ?? ""}`.toLowerCase();
	return /(web.?search|:online|\bonline\b|sonar|search-preview|search$)/.test(
		hay,
	);
}

function hashString(value: string) {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

export function modelColor(value: string) {
	const hash = hashString(value);
	const hue = hash % 360;
	const saturation = 62 + (hash % 22);
	const lightness = 42 + ((hash >> 4) % 14);
	return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function titleCase(value: string) {
	return value
		.split(/[\s_-]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function providerIds(providers?: GatewayProvider[]) {
	return [...new Set(providers?.map((provider) => provider.providerId) ?? [])];
}

export function providerLabel(providers?: GatewayProvider[]) {
	const ids = providerIds(providers);
	if (!ids.length) return "No provider";
	if (ids.length <= 2) return ids.map(titleCase).join(", ");
	return `${ids.slice(0, 2).map(titleCase).join(", ")} +${ids.length - 2}`;
}
