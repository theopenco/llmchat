import { describe, expect, it } from "vitest";

import { isAllowedDashboardOrigin } from "./origins";

const DASH = "https://llmchat-dashboard.meetploy.app";

describe("isAllowedDashboardOrigin", () => {
	it("allows the canonical dashboard origin", () => {
		expect(isAllowedDashboardOrigin(DASH, DASH)).toBe(true);
	});

	it("allows branch preview deployments of the dashboard", () => {
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard---iframe.meetploy.app",
				DASH,
			),
		).toBe(true);
	});

	it("allows commit preview deployments of the dashboard", () => {
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard--b9a8691.meetploy.app",
				DASH,
			),
		).toBe(true);
	});

	it("allows localhost in dev via exact match", () => {
		expect(
			isAllowedDashboardOrigin(
				"http://localhost:3001",
				"http://localhost:3001",
			),
		).toBe(true);
	});

	it("rejects other apps on the platform domain", () => {
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-api---iframe.meetploy.app",
				DASH,
			),
		).toBe(false);
		expect(
			isAllowedDashboardOrigin("https://evil-app---iframe.meetploy.app", DASH),
		).toBe(false);
	});

	it("rejects lookalike names without the preview separator", () => {
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard-evil.meetploy.app",
				DASH,
			),
		).toBe(false);
	});

	it("rejects the dashboard name on a different domain", () => {
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard---iframe.evil.app",
				DASH,
			),
		).toBe(false);
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard---iframe.meetploy.app.evil.com",
				DASH,
			),
		).toBe(false);
	});

	it("rejects protocol and port downgrades", () => {
		expect(
			isAllowedDashboardOrigin(
				"http://llmchat-dashboard---iframe.meetploy.app",
				DASH,
			),
		).toBe(false);
		expect(
			isAllowedDashboardOrigin(
				"https://llmchat-dashboard---iframe.meetploy.app:8443",
				DASH,
			),
		).toBe(false);
	});

	it("rejects missing or malformed values", () => {
		expect(isAllowedDashboardOrigin(undefined, DASH)).toBe(false);
		expect(isAllowedDashboardOrigin("null", DASH)).toBe(false);
		expect(isAllowedDashboardOrigin(DASH, undefined)).toBe(false);
		expect(
			isAllowedDashboardOrigin("https://x.meetploy.app", "not a url"),
		).toBe(false);
	});

	it("never widens single-label hosts into a wildcard", () => {
		expect(
			isAllowedDashboardOrigin(
				"http://localhost--evil:3001",
				"http://localhost:3001",
			),
		).toBe(false);
	});
});
