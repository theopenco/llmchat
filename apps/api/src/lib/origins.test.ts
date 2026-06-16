import { describe, expect, it } from "vitest";

import { isAllowedOrigin } from "./origins";

const DASH = "https://llmchat-dashboard.meetploy.app";

describe("isAllowedOrigin", () => {
	it("allows the canonical dashboard origin", () => {
		expect(isAllowedOrigin(DASH, DASH)).toBe(true);
	});

	it("allows branch preview deployments of the dashboard", () => {
		expect(
			isAllowedOrigin("https://llmchat-dashboard---iframe.meetploy.app", DASH),
		).toBe(true);
	});

	it("allows commit preview deployments of the dashboard", () => {
		expect(
			isAllowedOrigin("https://llmchat-dashboard--b9a8691.meetploy.app", DASH),
		).toBe(true);
	});

	it("allows localhost in dev via exact match", () => {
		expect(
			isAllowedOrigin("http://localhost:3001", "http://localhost:3001"),
		).toBe(true);
	});

	it("rejects other apps on the platform domain", () => {
		expect(
			isAllowedOrigin("https://llmchat-api---iframe.meetploy.app", DASH),
		).toBe(false);
		expect(
			isAllowedOrigin("https://evil-app---iframe.meetploy.app", DASH),
		).toBe(false);
	});

	it("rejects lookalike names without the preview separator", () => {
		expect(
			isAllowedOrigin("https://llmchat-dashboard-evil.meetploy.app", DASH),
		).toBe(false);
	});

	it("rejects the dashboard name on a different domain", () => {
		expect(
			isAllowedOrigin("https://llmchat-dashboard---iframe.evil.app", DASH),
		).toBe(false);
		expect(
			isAllowedOrigin(
				"https://llmchat-dashboard---iframe.meetploy.app.evil.com",
				DASH,
			),
		).toBe(false);
	});

	it("rejects protocol and port downgrades", () => {
		expect(
			isAllowedOrigin("http://llmchat-dashboard---iframe.meetploy.app", DASH),
		).toBe(false);
		expect(
			isAllowedOrigin(
				"https://llmchat-dashboard---iframe.meetploy.app:8443",
				DASH,
			),
		).toBe(false);
	});

	it("rejects missing or malformed values", () => {
		expect(isAllowedOrigin(undefined, DASH)).toBe(false);
		expect(isAllowedOrigin("null", DASH)).toBe(false);
		expect(isAllowedOrigin(DASH, undefined)).toBe(false);
		expect(isAllowedOrigin("https://x.meetploy.app", "not a url")).toBe(false);
	});

	it("never widens single-label hosts into a wildcard", () => {
		expect(
			isAllowedOrigin("http://localhost--evil:3001", "http://localhost:3001"),
		).toBe(false);
	});
});

describe("configured value normalization", () => {
	it("tolerates trailing slashes in configured origins", () => {
		expect(isAllowedOrigin(DASH, `${DASH}/`)).toBe(true);
	});
});
