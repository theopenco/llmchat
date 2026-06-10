"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// The gateway is a third-party API, so its payload is untrusted: validate the
// envelope and drop any individual model that doesn't carry the fields we render.
const gatewayProviderSchema = z.object({ providerId: z.string() });

const gatewayModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	family: z.string().optional(),
	providers: z.array(gatewayProviderSchema).optional(),
	supported_parameters: z.array(z.string()).optional(),
});

// `data` is required: a response without it is broken, not empty, and should
// surface the error state rather than silently render an empty model list.
const gatewayResponseSchema = z.object({
	data: z.array(z.unknown()),
});

export type GatewayProvider = z.infer<typeof gatewayProviderSchema>;
export type GatewayModel = z.infer<typeof gatewayModelSchema>;

const GATEWAY_URL = "https://api.llmgateway.io/v1/models";

export const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Validate an untrusted gateway payload into a clean model list. Throws when the
 * envelope is unrecognizable; silently drops individual models that are missing
 * the fields we render, so one bad row can't blank the whole picker.
 */
export function parseGatewayModels(raw: unknown): GatewayModel[] {
	const parsed = gatewayResponseSchema.safeParse(raw);
	if (!parsed.success) throw new Error("Unexpected gateway response");
	return parsed.data.data
		.map((model) => gatewayModelSchema.safeParse(model))
		.filter((result) => result.success)
		.map((result) => result.data);
}

/** Shared react-query hook so the picker and the model card don't double-fetch. */
export function useGatewayModels() {
	return useQuery({
		queryKey: ["gateway-models"],
		staleTime: 1000 * 60 * 30,
		queryFn: async (): Promise<GatewayModel[]> => {
			const res = await fetch(GATEWAY_URL);
			if (!res.ok) throw new Error(`Gateway ${res.status}`);
			return parseGatewayModels(await res.json());
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
