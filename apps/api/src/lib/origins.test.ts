import { describe, expect, it } from "vitest";

import { allowWidgetOrigin, isAllowedOrigin } from "./origins";

const DASH = "https://llmchat-dashboard.meetploy.app";
const SHOWCASE = "https://llmchat-showcase.meetploy.app";

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

describe("allowWidgetOrigin", () => {
	it('treats "*" as allow-all, returning a literal * for any origin', () => {
		expect(allowWidgetOrigin("https://customer.com", "*")).toBe("*");
		expect(allowWidgetOrigin("https://anything.example", "*")).toBe("*");
		expect(allowWidgetOrigin(undefined, "*")).toBe("*");
		// "*" anywhere in the list still allows all
		expect(allowWidgetOrigin("https://x.com", "https://a.com, *")).toBe("*");
	});

	it("falls open (reflects the origin) when the list is empty or unset", () => {
		expect(allowWidgetOrigin("https://customer.com", "")).toBe(
			"https://customer.com",
		);
		expect(allowWidgetOrigin("https://customer.com", undefined)).toBe(
			"https://customer.com",
		);
		expect(allowWidgetOrigin(undefined, "")).toBe("*");
	});

	it("allows listed origins and their Ploy previews", () => {
		const csv = `${SHOWCASE}, https://customer.com`;
		expect(allowWidgetOrigin(SHOWCASE, csv)).toBe(SHOWCASE);
		expect(allowWidgetOrigin("https://customer.com", csv)).toBe(
			"https://customer.com",
		);
		expect(
			allowWidgetOrigin("https://llmchat-showcase---iframe.meetploy.app", csv),
		).toBe("https://llmchat-showcase---iframe.meetploy.app");
		expect(
			allowWidgetOrigin("https://llmchat-showcase--b9a8691.meetploy.app", csv),
		).toBe("https://llmchat-showcase--b9a8691.meetploy.app");
	});

	it("rejects origins not in the list", () => {
		const csv = `${SHOWCASE}, https://customer.com`;
		expect(allowWidgetOrigin("https://evil.com", csv)).toBe(null);
		expect(allowWidgetOrigin("https://other.meetploy.app", csv)).toBe(null);
		expect(allowWidgetOrigin(undefined, csv)).toBe(null);
	});
});

describe("configured value normalization", () => {
	it("tolerates trailing slashes in configured origins", () => {
		expect(isAllowedOrigin(DASH, `${DASH}/`)).toBe(true);
		expect(allowWidgetOrigin(SHOWCASE, `${SHOWCASE}/`)).toBe(SHOWCASE);
		expect(
			allowWidgetOrigin(
				"https://llmchat-showcase---iframe.meetploy.app",
				`${SHOWCASE}/`,
			),
		).toBe("https://llmchat-showcase---iframe.meetploy.app");
	});
});

describe("allowWidgetOrigin with unusable config", () => {
	it("ignores unsubstituted env references and falls back to open", () => {
		expect(
			allowWidgetOrigin("https://customer.com", "$WIDGET_ALLOWED_ORIGINS"),
		).toBe("https://customer.com");
	});

	it("ignores junk entries but keeps valid ones restrictive", () => {
		const csv = "$WIDGET_ALLOWED_ORIGINS, https://customer.com";
		expect(allowWidgetOrigin("https://customer.com", csv)).toBe(
			"https://customer.com",
		);
		expect(allowWidgetOrigin("https://evil.com", csv)).toBe(null);
	});

	it("rejects non-http(s) schemes as entries", () => {
		expect(allowWidgetOrigin("https://x.com", "javascript:alert(1)")).toBe(
			"https://x.com",
		);
		expect(allowWidgetOrigin("file:///etc/passwd", "file://")).toBe(
			"file:///etc/passwd",
		);
	});
});
