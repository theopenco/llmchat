"use client";

import { useQuery } from "@tanstack/react-query";
import {
	DEFAULT_MODEL,
	isWebSearchModel,
	WEB_SEARCH_MODEL_IDS,
} from "@llmchat/shared";
import { z } from "zod";

// Re-exported so existing imports keep resolving from this module; the values
// themselves live in @llmchat/shared (the single source of truth).
export { DEFAULT_MODEL, isWebSearchModel, WEB_SEARCH_MODEL_IDS };

// The gateway is a third-party API, so its payload is untrusted: validate the
// envelope and drop any individual model that doesn't carry the fields we render.
// Every capability flag is optional — a missing flag means "unknown", never a
// fabricated capability.
const gatewayProviderSchema = z.object({
	providerId: z.string(),
	tools: z.boolean().optional(),
	vision: z.boolean().optional(),
	reasoning: z.boolean().optional(),
});

// Pricing values are per-token USD strings; only the two we display are read.
const gatewayPricingSchema = z
	.object({
		prompt: z.string().optional(),
		completion: z.string().optional(),
	})
	.optional();

const gatewayModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	family: z.string().optional(),
	providers: z.array(gatewayProviderSchema).optional(),
	supported_parameters: z.array(z.string()).optional(),
	context_length: z.number().optional(),
	pricing: gatewayPricingSchema,
	deprecated_at: z.string().optional(),
	deactivated_at: z.string().optional(),
});

// `data` is required: a response without it is broken, not empty, and should
// surface the error state rather than silently render an empty model list.
const gatewayResponseSchema = z.object({
	data: z.array(z.unknown()),
});

export type GatewayProvider = z.infer<typeof gatewayProviderSchema>;
export type GatewayModel = z.infer<typeof gatewayModelSchema>;

const GATEWAY_URL = "https://api.llmgateway.io/v1/models";

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

/** True when the gateway lists this model as web-search-capable. */
export function hasWebSearch(model: GatewayModel): boolean {
	return isWebSearchModel(model.id);
}

/** Narrow a model list to only web-search-capable models. */
export function webSearchModels(models: GatewayModel[]): GatewayModel[] {
	return models.filter(hasWebSearch);
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

export interface ModelCapabilities {
	tools: boolean;
	vision: boolean;
	reasoning: boolean;
}

/**
 * Capabilities a model supports through ANY of its providers — read straight
 * from the gateway's per-provider flags, never inferred. A flag absent on
 * every provider means "not advertised", so we report false.
 */
export function modelCapabilities(model: GatewayModel): ModelCapabilities {
	const providers = model.providers ?? [];
	return {
		tools: providers.some((p) => p.tools === true),
		vision: providers.some((p) => p.vision === true),
		reasoning: providers.some((p) => p.reasoning === true),
	};
}

/** A model the gateway has scheduled for retirement (still listed). */
export function isDeprecated(model: GatewayModel): boolean {
	return Boolean(model.deprecated_at);
}

/** A model the gateway has already turned off — selecting it will fail. */
export function isDeactivated(model: GatewayModel): boolean {
	return Boolean(model.deactivated_at);
}

/** Compact context window, e.g. "128K" or "1M"; null when unknown/zero. */
export function formatContextLength(model: GatewayModel): string | null {
	const n = model.context_length;
	if (!n || n <= 0) return null;
	if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
	return `${Math.round(n / 1000)}K`;
}

/**
 * Per-1M-token price as "$IN / $OUT", derived from the gateway's per-token
 * USD strings. Returns null when pricing is absent or all-zero (free/unknown),
 * so we never display fabricated numbers.
 */
export function formatPricing(model: GatewayModel): string | null {
	const prompt = Number.parseFloat(model.pricing?.prompt ?? "");
	const completion = Number.parseFloat(model.pricing?.completion ?? "");
	const inPm = Number.isFinite(prompt) ? prompt * 1_000_000 : 0;
	const outPm = Number.isFinite(completion) ? completion * 1_000_000 : 0;
	if (inPm <= 0 && outPm <= 0) return null;
	return `$${inPm.toFixed(2)} / $${outPm.toFixed(2)} per 1M`;
}
