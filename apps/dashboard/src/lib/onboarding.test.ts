import { describe, expect, it } from "vitest";

import {
	defaultSystemPrompt,
	defaultWelcomeMessage,
	resolveOnboardingState,
} from "./onboarding";

describe("defaultSystemPrompt", () => {
	it("names the business and instructs a human-handoff fallback", () => {
		const prompt = defaultSystemPrompt("Acme Tools");
		expect(prompt).toContain("Acme Tools");
		expect(prompt.toLowerCase()).toContain("human");
	});

	it("degrades gracefully when the name is blank", () => {
		expect(defaultSystemPrompt("   ")).toContain("this business");
	});
});

describe("defaultWelcomeMessage", () => {
	it("mentions the business name when present", () => {
		expect(defaultWelcomeMessage("Acme")).toBe(
			"Hi! How can I help you with Acme today?",
		);
	});

	it("falls back to a generic greeting", () => {
		expect(defaultWelcomeMessage("  ")).toBe("Hi! How can I help you today?");
	});
});

describe("resolveOnboardingState", () => {
	it("reports loading before anything is known", () => {
		expect(
			resolveOnboardingState({
				loading: true,
				hasWorkspace: false,
				projectsLoaded: false,
				projectCount: 0,
			}),
		).toBe("loading");
	});

	it("needs onboarding with no workspace (brand-new account)", () => {
		expect(
			resolveOnboardingState({
				loading: false,
				hasWorkspace: false,
				projectsLoaded: false,
				projectCount: 0,
			}),
		).toBe("needs-onboarding");
	});

	it("needs onboarding when a SUCCESSFUL projects fetch returns zero", () => {
		expect(
			resolveOnboardingState({
				loading: false,
				hasWorkspace: true,
				projectsLoaded: true,
				projectCount: 0,
			}),
		).toBe("needs-onboarding");
	});

	it("is ready only with a workspace AND at least one project", () => {
		expect(
			resolveOnboardingState({
				loading: false,
				hasWorkspace: true,
				projectsLoaded: true,
				projectCount: 1,
			}),
		).toBe("ready");
	});

	it("treats loading as authoritative even if counts look ready", () => {
		// Guards against flashing the dashboard before data settles.
		expect(
			resolveOnboardingState({
				loading: true,
				hasWorkspace: true,
				projectsLoaded: true,
				projectCount: 3,
			}),
		).toBe("loading");
	});

	it("does NOT conclude needs-onboarding from a failed/unsettled projects fetch", () => {
		// The sharp bug: a failed `/api/projects` reports projectCount:0 with
		// loading:false — identical to a genuine empty workspace. Concluding
		// "needs-onboarding" here bounces a PAYING customer into onboarding, where
		// rebuilding can provision a duplicate workspace. With projectsLoaded:false
		// (isSuccess === false → error or pending) we must hold, never bounce.
		expect(
			resolveOnboardingState({
				loading: false,
				hasWorkspace: true,
				projectsLoaded: false,
				projectCount: 0,
			}),
		).not.toBe("needs-onboarding");
		expect(
			resolveOnboardingState({
				loading: false,
				hasWorkspace: true,
				projectsLoaded: false,
				projectCount: 0,
			}),
		).toBe("loading");
	});
});
