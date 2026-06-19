import { describe, expect, it } from "vitest";

import {
	BILLING_TIERS,
	PAID_PLANS,
	isModelAllowed,
	isOverResponseQuota,
	isPaidPlan,
	isWithinLimit,
	planEntitlements,
	showPoweredByBadge,
} from "./billing-tiers";

describe("planEntitlements", () => {
	it("resolves each known tier to its own entitlements", () => {
		expect(planEntitlements("starter")).toBe(BILLING_TIERS.starter);
		expect(planEntitlements("growth")).toBe(BILLING_TIERS.growth);
		expect(planEntitlements("scale")).toBe(BILLING_TIERS.scale);
		expect(planEntitlements("none")).toBe(BILLING_TIERS.none);
	});

	it("resolves unknown/legacy/empty plans to `none` — blocked, never entitled", () => {
		// Paid-only: an unrecognized value must grant nothing, not silently fall
		// through to a working tier. `free`/`pro` are pre-migration legacy values.
		expect(planEntitlements("free")).toBe(BILLING_TIERS.none);
		expect(planEntitlements("pro")).toBe(BILLING_TIERS.none);
		expect(planEntitlements("enterprise")).toBe(BILLING_TIERS.none);
		expect(planEntitlements("")).toBe(BILLING_TIERS.none);
		expect(planEntitlements(null)).toBe(BILLING_TIERS.none);
		expect(planEntitlements(undefined)).toBe(BILLING_TIERS.none);
	});
});

describe("tier shape invariants", () => {
	it("blocks the unpaid tier from everything billable", () => {
		const none = BILLING_TIERS.none;
		expect(none.maxProjects).toBe(0);
		expect(none.maxResponsesPerMonth).toBe(0);
		expect(none.allowOverage).toBe(false);
	});

	it("only Starter hard-stops; Growth/Scale meter overage", () => {
		expect(BILLING_TIERS.starter.allowOverage).toBe(false);
		expect(BILLING_TIERS.growth.allowOverage).toBe(true);
		expect(BILLING_TIERS.scale.allowOverage).toBe(true);
	});

	it("entitlements are monotonic up the paid ladder", () => {
		const [s, g, sc] = [
			BILLING_TIERS.starter,
			BILLING_TIERS.growth,
			BILLING_TIERS.scale,
		];
		expect(s.maxProjects).toBeLessThan(g.maxProjects);
		expect(g.maxProjects).toBeLessThan(sc.maxProjects);
		expect(s.maxMembers).toBeLessThan(g.maxMembers);
		expect(g.maxMembers).toBeLessThan(sc.maxMembers);
		expect(s.maxResponsesPerMonth).toBeLessThan(g.maxResponsesPerMonth);
		expect(g.maxResponsesPerMonth).toBeLessThan(sc.maxResponsesPerMonth);
	});

	it("matches the spec's exact tier numbers", () => {
		expect(BILLING_TIERS.starter).toMatchObject({
			maxProjects: 1,
			maxMembers: 1,
			maxResponsesPerMonth: 1_000,
			modelAccess: "basic",
			branding: "badge",
		});
		expect(BILLING_TIERS.growth).toMatchObject({
			maxProjects: 3,
			maxMembers: 5,
			maxResponsesPerMonth: 5_000,
			modelAccess: "all",
			branding: "off",
		});
		expect(BILLING_TIERS.scale).toMatchObject({
			maxProjects: 10,
			maxMembers: 20,
			maxResponsesPerMonth: 20_000,
			modelAccess: "all",
			branding: "custom",
		});
	});
});

describe("isPaidPlan", () => {
	it("is true only for the three paid tiers", () => {
		expect(PAID_PLANS).toEqual(["starter", "growth", "scale"]);
		for (const p of PAID_PLANS) expect(isPaidPlan(p)).toBe(true);
		expect(isPaidPlan("none")).toBe(false);
		expect(isPaidPlan("free")).toBe(false);
		expect(isPaidPlan(null)).toBe(false);
		expect(isPaidPlan(undefined)).toBe(false);
	});
});

describe("isWithinLimit", () => {
	it("treats the limit as a hard ceiling (count === max is NOT within)", () => {
		expect(isWithinLimit(0, 1)).toBe(true);
		expect(isWithinLimit(1, 1)).toBe(false); // at the ceiling → blocked
		expect(isWithinLimit(2, 1)).toBe(false); // somehow over → blocked
	});

	it("blocks creation at the unpaid tier's zero ceiling", () => {
		expect(isWithinLimit(0, BILLING_TIERS.none.maxProjects)).toBe(false);
	});
});

describe("isOverResponseQuota", () => {
	it("hard-stops a fixed plan at (and past) its included quota", () => {
		expect(isOverResponseQuota("starter", 999)).toBe(false);
		expect(isOverResponseQuota("starter", 1_000)).toBe(true); // at cap → blocked
		expect(isOverResponseQuota("starter", 5_000)).toBe(true);
	});

	it("never blocks a plan with overage — Stripe meters the excess", () => {
		expect(isOverResponseQuota("growth", 5_000)).toBe(false);
		expect(isOverResponseQuota("growth", 50_000)).toBe(false);
		expect(isOverResponseQuota("scale", 1_000_000)).toBe(false);
	});

	it("blocks an unpaid workspace immediately (zero quota, no overage)", () => {
		expect(isOverResponseQuota("none", 0)).toBe(true);
		expect(isOverResponseQuota("free", 0)).toBe(true); // legacy → none
	});
});

describe("isModelAllowed", () => {
	it("restricts Starter to basic (mini/nano/haiku/flash/lite/small) models", () => {
		expect(isModelAllowed("starter", "gpt-5.4-mini")).toBe(true);
		expect(isModelAllowed("starter", "claude-haiku-4-5")).toBe(true);
		expect(isModelAllowed("starter", "gemini-2.5-flash")).toBe(true);
		expect(isModelAllowed("starter", "claude-opus-4-8")).toBe(false);
		expect(isModelAllowed("starter", "gpt-5.4")).toBe(false);
	});

	it("lets Growth/Scale run any model", () => {
		expect(isModelAllowed("growth", "claude-opus-4-8")).toBe(true);
		expect(isModelAllowed("scale", "gpt-5.4")).toBe(true);
	});

	it("an unpaid/unknown plan is clamped to basic-only", () => {
		expect(isModelAllowed("none", "claude-opus-4-8")).toBe(false);
		expect(isModelAllowed("none", "gpt-5.4-mini")).toBe(true);
		expect(isModelAllowed("free", "claude-opus-4-8")).toBe(false);
	});
});

describe("showPoweredByBadge", () => {
	it("is shown on Starter, hidden on Growth/Scale", () => {
		expect(showPoweredByBadge("starter")).toBe(true);
		expect(showPoweredByBadge("growth")).toBe(false);
		expect(showPoweredByBadge("scale")).toBe(false);
	});

	it("defaults to shown for unpaid/unknown (never silently un-brands)", () => {
		expect(showPoweredByBadge("none")).toBe(true);
		expect(showPoweredByBadge("free")).toBe(true);
		expect(showPoweredByBadge(undefined)).toBe(true);
	});
});
