import { describe, expect, it } from "vitest";

import {
	DEFAULT_MODEL,
	effectiveModel,
	isWebSearchModel,
	WEB_SEARCH_MODEL_IDS,
} from "./models";

describe("isWebSearchModel", () => {
	it("is true for members of the canonical set", () => {
		for (const id of WEB_SEARCH_MODEL_IDS) {
			expect(isWebSearchModel(id)).toBe(true);
		}
	});

	it("is false for retired / non-web-search ids", () => {
		expect(isWebSearchModel("openai/gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4.1-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4o-search-preview")).toBe(false);
		expect(isWebSearchModel("")).toBe(false);
	});
});

describe("DEFAULT_MODEL", () => {
	it("is itself a web-search model", () => {
		expect(isWebSearchModel(DEFAULT_MODEL)).toBe(true);
	});
});

describe("effectiveModel", () => {
	it("keeps a valid web-search model untouched", () => {
		expect(effectiveModel("claude-opus-4-8")).toBe("claude-opus-4-8");
		expect(effectiveModel(DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
	});

	it("falls back to the default for a stale / unknown / empty model", () => {
		expect(effectiveModel("openai/gpt-4o-mini")).toBe(DEFAULT_MODEL);
		expect(effectiveModel("gpt-4o-search-preview")).toBe(DEFAULT_MODEL);
		expect(effectiveModel("")).toBe(DEFAULT_MODEL);
		expect(effectiveModel(null)).toBe(DEFAULT_MODEL);
		expect(effectiveModel(undefined)).toBe(DEFAULT_MODEL);
	});
});
