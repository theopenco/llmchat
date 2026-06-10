import { describe, expect, it } from "vitest";

import {
	hasWebSearch,
	modelColor,
	parseGatewayModels,
	providerLabel,
	titleCase,
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
	it("detects an explicit web_search supported parameter", () => {
		expect(
			hasWebSearch({
				id: "x",
				name: "X",
				supported_parameters: ["web_search"],
			}),
		).toBe(true);
	});

	it("detects web-search naming conventions", () => {
		expect(hasWebSearch({ id: "sonar", name: "Sonar" })).toBe(true);
		expect(hasWebSearch({ id: "gpt-4o:online", name: "GPT-4o Online" })).toBe(
			true,
		);
		expect(
			hasWebSearch({ id: "gpt-4o-search-preview", name: "Search Preview" }),
		).toBe(true);
	});

	it("returns false for plain chat models", () => {
		expect(hasWebSearch({ id: "gpt-4o-mini", name: "GPT-4o mini" })).toBe(
			false,
		);
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
