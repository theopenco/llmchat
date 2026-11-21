import { describe, expect, it } from "vitest";

import {
	DEFAULT_MODEL,
	effectiveModel,
	isWebSearchModel,
	WEB_SEARCH_MODEL_IDS,
	WEB_SEARCH_MODELS,
} from "./models";

describe("WEB_SEARCH_MODELS (generated snapshot)", () => {
	it("is non-empty — a blank list would blank the model picker", () => {
		expect(WEB_SEARCH_MODELS.length).toBeGreaterThan(0);
	});

	it("contains the default model", () => {
		expect(WEB_SEARCH_MODELS).toContain(DEFAULT_MODEL);
	});

	it("offers the current gateway generation and drops deactivated routes", () => {
		for (const id of [
			"gpt-6-luna",
			"gpt-6.2-sol",
			"claude-sonnet-5-5",
			"gemini-4-neon",
		]) {
			expect(WEB_SEARCH_MODELS).toContain(id);
		}
		for (const id of [
			"claude-3-5-haiku",
			"gemini-2.5-pro",
			"gpt-4o-search-preview",
		]) {
			expect(WEB_SEARCH_MODELS).not.toContain(id);
		}
	});

	it("excludes image-generation models", () => {
		expect(WEB_SEARCH_MODELS).not.toContain("gemini-nano-banana-2.1");
	});
});

describe("isWebSearchModel", () => {
	it("is true for members of the generated set", () => {
		for (const id of WEB_SEARCH_MODEL_IDS) {
			expect(isWebSearchModel(id)).toBe(true);
		}
	});

	it("is false for non-web-search ids", () => {
		expect(isWebSearchModel("openai/gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4.1-mini")).toBe(false);
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
		expect(effectiveModel("gpt-4o-mini")).toBe(DEFAULT_MODEL);
		expect(effectiveModel("")).toBe(DEFAULT_MODEL);
		expect(effectiveModel(null)).toBe(DEFAULT_MODEL);
		expect(effectiveModel(undefined)).toBe(DEFAULT_MODEL);
	});
});
