import { describe, expect, it } from "vitest";

import {
	DEFAULT_MODEL,
	formatContextLength,
	formatPricing,
	hasWebSearch,
	isDeactivated,
	isDeprecated,
	modelCapabilities,
	modelColor,
	parseGatewayModels,
	providerLabel,
	titleCase,
	WEB_SEARCH_MODEL_IDS,
	webSearchModels,
} from "./model-data";

describe("parseGatewayModels", () => {
	it("throws when the envelope is not the expected shape", () => {
		expect(() => parseGatewayModels(null)).toThrow();
		expect(() => parseGatewayModels({ models: [] })).toThrow(); // wrong key
		expect(() => parseGatewayModels({})).toThrow(); // missing data
		expect(() => parseGatewayModels({ data: "nope" })).toThrow(); // data not array
	});

	it("returns an empty list for a well-formed but empty response", () => {
		expect(parseGatewayModels({ data: [] })).toEqual([]);
	});

	it("keeps valid models and drops malformed rows", () => {
		const result = parseGatewayModels({
			data: [
				{ id: "gpt-4o", name: "GPT-4o" },
				{ id: "no-name" }, // missing required name -> dropped
				{ name: "no-id" }, // missing required id -> dropped
				42, // not even an object -> dropped
				{
					id: "claude",
					name: "Claude",
					providers: [{ providerId: "anthropic" }],
				},
			],
		});
		expect(result.map((m) => m.id)).toEqual(["gpt-4o", "claude"]);
	});

	it("ignores unknown extra fields rather than failing", () => {
		const result = parseGatewayModels({
			data: [{ id: "x", name: "X", undocumented: true }],
		});
		expect(result).toHaveLength(1);
	});
});

describe("hasWebSearch", () => {
	it("is true only for ids in the vendor's web-search set", () => {
		for (const id of WEB_SEARCH_MODEL_IDS) {
			expect(hasWebSearch({ id, name: id })).toBe(true);
		}
	});

	it("does NOT guess from names — a non-listed model is false even if its name screams search", () => {
		// Search-y names that aren't in the generated set must be excluded; the
		// list is membership-based, not heuristic.
		expect(hasWebSearch({ id: "made-up-sonar", name: "Sonar" })).toBe(false);
		expect(hasWebSearch({ id: "ghost:online", name: "Ghost Online" })).toBe(
			false,
		);
		expect(
			hasWebSearch({ id: "fake-search-preview", name: "Search Preview" }),
		).toBe(false);
	});

	it("does NOT trust a self-declared web_search supported parameter", () => {
		// supported_parameters is untrusted gateway data; membership is the
		// authority, not a flag a row can set on itself.
		expect(
			hasWebSearch({
				id: "totally-not-web-search",
				name: "X",
				supported_parameters: ["web_search"],
			}),
		).toBe(false);
	});

	it("returns false for plain chat models", () => {
		expect(hasWebSearch({ id: "gpt-4o-mini", name: "GPT-4o mini" })).toBe(
			false,
		);
		expect(hasWebSearch({ id: "gpt-4.1-mini", name: "GPT-4.1 mini" })).toBe(
			false,
		);
	});
});

describe("webSearchModels", () => {
	it("keeps only web-search models and preserves their objects", () => {
		const models = [
			{ id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
			{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini" }, // not web search
			{ id: "claude-opus-4-8", name: "Claude Opus 4.8" },
			{ id: "gpt-4o-mini", name: "GPT-4o mini" }, // not web search
		];
		expect(webSearchModels(models).map((m) => m.id)).toEqual([
			"gpt-5.4-mini",
			"claude-opus-4-8",
		]);
	});

	it("returns an empty list when nothing qualifies", () => {
		expect(webSearchModels([{ id: "gpt-4o-mini", name: "x" }])).toEqual([]);
	});
});

describe("DEFAULT_MODEL", () => {
	it("is itself a web-search model, so it survives the picker's filter", () => {
		expect(WEB_SEARCH_MODEL_IDS.has(DEFAULT_MODEL)).toBe(true);
		expect(hasWebSearch({ id: DEFAULT_MODEL, name: DEFAULT_MODEL })).toBe(true);
	});
});

describe("modelCapabilities", () => {
	it("reports a capability when any provider advertises it", () => {
		const caps = modelCapabilities({
			id: "x",
			name: "X",
			providers: [
				{ providerId: "a", tools: false },
				{ providerId: "b", tools: true, vision: true },
			],
		});
		expect(caps).toEqual({ tools: true, vision: true, reasoning: false });
	});

	it("never infers a capability that no provider declares", () => {
		expect(
			modelCapabilities({
				id: "x",
				name: "X",
				providers: [{ providerId: "a" }],
			}),
		).toEqual({ tools: false, vision: false, reasoning: false });
		expect(modelCapabilities({ id: "x", name: "X" })).toEqual({
			tools: false,
			vision: false,
			reasoning: false,
		});
	});
});

describe("deprecation flags", () => {
	it("reads deprecated_at / deactivated_at straight from metadata", () => {
		expect(
			isDeprecated({ id: "x", name: "X", deprecated_at: "2026-01-09" }),
		).toBe(true);
		expect(isDeprecated({ id: "x", name: "X" })).toBe(false);
		expect(
			isDeactivated({ id: "x", name: "X", deactivated_at: "2026-03-31" }),
		).toBe(true);
		expect(isDeactivated({ id: "x", name: "X" })).toBe(false);
	});
});

describe("formatContextLength", () => {
	it("formats K and M windows and hides unknown/zero", () => {
		expect(
			formatContextLength({ id: "x", name: "X", context_length: 128000 }),
		).toBe("128K");
		expect(
			formatContextLength({ id: "x", name: "X", context_length: 1048576 }),
		).toBe("1M");
		expect(formatContextLength({ id: "x", name: "X", context_length: 0 })).toBe(
			null,
		);
		expect(formatContextLength({ id: "x", name: "X" })).toBe(null);
	});
});

describe("formatPricing", () => {
	it("converts per-token strings to a per-1M label", () => {
		expect(
			formatPricing({
				id: "x",
				name: "X",
				pricing: { prompt: "0.0000004", completion: "0.0000016" },
			}),
		).toBe("$0.40 / $1.60 per 1M");
	});

	it("returns null when pricing is absent or all zero (never fabricates)", () => {
		expect(formatPricing({ id: "x", name: "X" })).toBe(null);
		expect(
			formatPricing({
				id: "x",
				name: "X",
				pricing: { prompt: "0", completion: "0" },
			}),
		).toBe(null);
	});
});

describe("parseGatewayModels with capability metadata", () => {
	it("keeps capability flags, pricing, context, and deprecation fields", () => {
		const [m] = parseGatewayModels({
			data: [
				{
					id: "gpt-4.1-mini",
					name: "GPT-4.1 mini",
					context_length: 1000000,
					providers: [{ providerId: "openai", tools: true, vision: true }],
					pricing: { prompt: "0.0000004", completion: "0.0000016" },
					deprecated_at: "2026-01-09",
				},
			],
		});
		expect(m.context_length).toBe(1000000);
		expect(modelCapabilities(m)).toMatchObject({ tools: true, vision: true });
		expect(formatPricing(m)).toBe("$0.40 / $1.60 per 1M");
		expect(isDeprecated(m)).toBe(true);
	});
});

describe("modelColor", () => {
	it("is deterministic and a valid hsl string", () => {
		expect(modelColor("gpt-4o")).toBe(modelColor("gpt-4o"));
		expect(modelColor("gpt-4o")).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
	});

	it("varies by input", () => {
		expect(modelColor("gpt-4o")).not.toBe(modelColor("claude"));
	});
});

describe("titleCase", () => {
	it("splits on spaces, dashes, and underscores", () => {
		expect(titleCase("open_ai")).toBe("Open Ai");
		expect(titleCase("search-preview")).toBe("Search Preview");
	});
});

describe("providerLabel", () => {
	it("summarizes provider lists, collapsing the long tail", () => {
		expect(providerLabel(undefined)).toBe("No provider");
		expect(providerLabel([{ providerId: "openai" }])).toBe("Openai");
		expect(
			providerLabel([
				{ providerId: "openai" },
				{ providerId: "azure" },
				{ providerId: "bedrock" },
			]),
		).toBe("Openai, Azure +1");
	});

	it("de-duplicates repeated providers", () => {
		expect(
			providerLabel([{ providerId: "openai" }, { providerId: "openai" }]),
		).toBe("Openai");
	});
});
