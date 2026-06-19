import { describe, expect, it } from "vitest";

import {
	DEFAULT_BRAND,
	hasErrors,
	initialDraft,
	validateBotForm,
	type BotDraft,
} from "./bot-form";

const draft = (over: Partial<BotDraft> = {}): BotDraft => ({
	...initialDraft(),
	name: "Acme",
	...over,
});

describe("initialDraft", () => {
	it("seeds the default greeting and brand, with no source", () => {
		const d = initialDraft();
		expect(d.name).toBe("");
		expect(d.welcomeMessage).toMatch(/help you/i); // the default greeting
		expect(d.brandColor).toBe(DEFAULT_BRAND);
		expect(d.sourceUrl).toBeNull();
	});
});

describe("validateBotForm", () => {
	it("passes a complete draft", () => {
		expect(hasErrors(validateBotForm(draft()))).toBe(false);
	});

	it("requires a name", () => {
		expect(validateBotForm(draft({ name: "   " })).name).toMatch(/name/i);
	});

	it("rejects an over-long name", () => {
		expect(validateBotForm(draft({ name: "a".repeat(61) })).name).toMatch(
			/under 60/i,
		);
	});

	it("requires a welcome message", () => {
		expect(
			validateBotForm(draft({ welcomeMessage: "" })).welcomeMessage,
		).toMatch(/greeting/i);
	});

	it("treats a blank/absent source URL as valid (optional)", () => {
		expect(
			validateBotForm(draft({ sourceUrl: null })).sourceUrl,
		).toBeUndefined();
		expect(
			validateBotForm(draft({ sourceUrl: "  " })).sourceUrl,
		).toBeUndefined();
	});

	it("rejects a malformed source URL", () => {
		expect(
			validateBotForm(draft({ sourceUrl: "not a url" })).sourceUrl,
		).toMatch(/valid url/i);
	});

	it("rejects a non-http(s) source URL", () => {
		expect(
			validateBotForm(draft({ sourceUrl: "ftp://example.com" })).sourceUrl,
		).toMatch(/http/i);
	});

	it("accepts a valid https source URL", () => {
		expect(
			hasErrors(validateBotForm(draft({ sourceUrl: "https://example.com" }))),
		).toBe(false);
	});
});
