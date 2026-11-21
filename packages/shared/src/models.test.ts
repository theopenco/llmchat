import { describe, expect, it } from "vitest";

import {
	DEFAULT_MODEL,
	effectiveModel,
	isWebSearchModel,
	offeredWebSearchModels,
	WEB_SEARCH_MODEL_IDS,
	WEB_SEARCH_MODEL_RETIREMENTS,
	WEB_SEARCH_MODELS,
} from "./models";

// The day the snapshot was generated: every listed model is offered then.
const SNAPSHOT_DAY = Date.parse("2026-11-21");

describe("WEB_SEARCH_MODELS (generated snapshot)", () => {
	it("is non-empty — a blank list would blank the model picker", () => {
		expect(WEB_SEARCH_MODELS.length).toBeGreaterThan(0);
	});

	it("contains the default model, which has no scheduled retirement", () => {
		expect(WEB_SEARCH_MODELS).toContain(DEFAULT_MODEL);
		expect(WEB_SEARCH_MODEL_RETIREMENTS[DEFAULT_MODEL]).toBeUndefined();
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

	it("never offers a model whose only web-search route is deprecated or retiring soon", () => {
		// claude-sonnet-4-5: deprecated, deactivates 2026-11-30. GPT-5 family and
		// gpt-4o: their web-search route deactivates within the 90-day horizon.
		for (const id of [
			"claude-sonnet-4-5",
			"claude-sonnet-4-5-20250929",
			"gpt-5",
			"gpt-5-mini",
			"gpt-5-nano",
			"gpt-4o",
			"gemini-3.7-flash",
		]) {
			expect(WEB_SEARCH_MODELS).not.toContain(id);
		}
	});

	it("dates every retirement it records, and only for listed models", () => {
		for (const [id, date] of Object.entries(WEB_SEARCH_MODEL_RETIREMENTS)) {
			expect(WEB_SEARCH_MODEL_IDS.has(id)).toBe(true);
			expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(Date.parse(date)).toBeGreaterThan(SNAPSHOT_DAY);
		}
	});

	it("excludes image-generation models", () => {
		expect(WEB_SEARCH_MODELS).not.toContain("gemini-nano-banana-2.1");
	});
});

describe("isWebSearchModel", () => {
	it("is true for every member of the snapshot on the day it was generated", () => {
		for (const id of WEB_SEARCH_MODEL_IDS) {
			expect(isWebSearchModel(id, SNAPSHOT_DAY)).toBe(true);
		}
	});

	it("is false for non-web-search ids", () => {
		expect(isWebSearchModel("openai/gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4o-mini")).toBe(false);
		expect(isWebSearchModel("gpt-4.1-mini")).toBe(false);
		expect(isWebSearchModel("")).toBe(false);
	});

	it("stops accepting a model on its retirement day, without a regenerate", () => {
		const entries = Object.entries(WEB_SEARCH_MODEL_RETIREMENTS);
		expect(entries.length).toBeGreaterThan(0);
		for (const [id, date] of entries) {
			const retires = Date.parse(date);
			expect(isWebSearchModel(id, retires - 1)).toBe(true);
			expect(isWebSearchModel(id, retires)).toBe(false);
			expect(offeredWebSearchModels(retires)).not.toContain(id);
		}
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
		expect(effectiveModel("claude-sonnet-4-5")).toBe(DEFAULT_MODEL);
		expect(effectiveModel("gpt-5-mini")).toBe(DEFAULT_MODEL);
		expect(effectiveModel("")).toBe(DEFAULT_MODEL);
		expect(effectiveModel(null)).toBe(DEFAULT_MODEL);
		expect(effectiveModel(undefined)).toBe(DEFAULT_MODEL);
	});

	it("falls back once a saved model's gateway routes retire", () => {
		for (const [id, date] of Object.entries(WEB_SEARCH_MODEL_RETIREMENTS)) {
			const retires = Date.parse(date);
			expect(effectiveModel(id, retires - 1)).toBe(id);
			expect(effectiveModel(id, retires)).toBe(DEFAULT_MODEL);
		}
	});
});
