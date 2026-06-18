import { describe, expect, it } from "vitest";

import {
	applyAnswer,
	botPrompt,
	BRAND_CHOICES,
	DEFAULT_BRAND,
	emptyDraft,
	nextStep,
	STEP_ORDER,
	validateAnswer,
	welcomePrefill,
} from "./concierge-script";

describe("concierge-script", () => {
	it("starts with an indigo-defaulted, empty draft", () => {
		const d = emptyDraft();
		expect(d).toEqual({
			name: "",
			welcomeMessage: "",
			brandColor: DEFAULT_BRAND,
			sourceUrl: null,
		});
		expect(BRAND_CHOICES[0].value).toBe(DEFAULT_BRAND);
	});

	it("walks name → welcome → brand → source then ends", () => {
		expect(STEP_ORDER).toEqual(["name", "welcome", "brand", "source"]);
		expect(nextStep("name")).toBe("welcome");
		expect(nextStep("brand")).toBe("source");
		expect(nextStep("source")).toBeNull();
	});

	describe("name", () => {
		it("requires a non-empty value", () => {
			expect(validateAnswer("name", "   ")).toMatch(/name/i);
			expect(validateAnswer("name", "Acme")).toBeNull();
		});
		it("rejects an overly long name", () => {
			expect(validateAnswer("name", "x".repeat(61))).toMatch(/under/i);
		});
		it("trims into the draft", () => {
			expect(applyAnswer("name", "  Acme  ", emptyDraft()).name).toBe("Acme");
		});
	});

	describe("welcome", () => {
		it("offers a greeting seeded from the name", () => {
			const d = applyAnswer("name", "Acme", emptyDraft());
			expect(welcomePrefill(d)).toContain("Acme");
		});
		it("requires a greeting and caps its length", () => {
			expect(validateAnswer("welcome", "")).toMatch(/greeting/i);
			expect(validateAnswer("welcome", "x".repeat(301))).toMatch(/under/i);
			expect(validateAnswer("welcome", "Hi there!")).toBeNull();
		});
	});

	describe("brand", () => {
		it("is always valid (chosen from chips) and stored verbatim", () => {
			expect(validateAnswer("brand", "#10B981")).toBeNull();
			expect(applyAnswer("brand", "#10B981", emptyDraft()).brandColor).toBe(
				"#10B981",
			);
		});
	});

	describe("source (optional)", () => {
		it("treats an empty answer as skip → null", () => {
			expect(validateAnswer("source", "")).toBeNull();
			expect(applyAnswer("source", "  ", emptyDraft()).sourceUrl).toBeNull();
		});
		it("accepts a valid http(s) URL", () => {
			expect(validateAnswer("source", "https://acme.com/docs")).toBeNull();
			expect(
				applyAnswer("source", "https://acme.com/docs", emptyDraft()).sourceUrl,
			).toBe("https://acme.com/docs");
		});
		it("rejects a malformed URL or non-http scheme", () => {
			expect(validateAnswer("source", "not a url")).toMatch(/valid url/i);
			expect(validateAnswer("source", "javascript:alert(1)")).toMatch(/http/i);
		});
	});

	it("personalizes the welcome prompt with the collected name", () => {
		const d = applyAnswer("name", "Acme", emptyDraft());
		expect(botPrompt("welcome", d)).toContain("Acme");
		// Falls back gracefully before a name exists.
		expect(botPrompt("welcome", emptyDraft())).toContain("you");
	});
});
