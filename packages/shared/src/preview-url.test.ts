import { describe, expect, it } from "vitest";

import { resolveSiblingUrl } from "./preview-url";

const API = "https://llmchat-api.meetploy.app";

describe("resolveSiblingUrl", () => {
	it("maps a branch preview host onto the sibling service", () => {
		expect(
			resolveSiblingUrl(API, "llmchat-dashboard---iframe.meetploy.app"),
		).toBe("https://llmchat-api---iframe.meetploy.app");
	});

	it("maps a commit preview host onto the sibling service", () => {
		expect(
			resolveSiblingUrl(API, "llmchat-showcase--b9a8691.meetploy.app"),
		).toBe("https://llmchat-api--b9a8691.meetploy.app");
	});

	it("keeps the canonical url on the canonical host", () => {
		expect(resolveSiblingUrl(API, "llmchat-dashboard.meetploy.app")).toBe(API);
	});

	it("keeps the canonical url on localhost", () => {
		expect(resolveSiblingUrl("http://localhost:8787", "localhost")).toBe(
			"http://localhost:8787",
		);
		expect(resolveSiblingUrl(API, "localhost")).toBe(API);
	});

	it("keeps the canonical url on a custom domain", () => {
		expect(resolveSiblingUrl(API, "app--staging.example.com")).toBe(API);
	});

	it("preserves branch suffixes that themselves contain dashes", () => {
		expect(
			resolveSiblingUrl(API, "llmchat-dashboard---fix-cors-bug.meetploy.app"),
		).toBe("https://llmchat-api---fix-cors-bug.meetploy.app");
	});

	it("returns malformed canonical urls unchanged", () => {
		expect(resolveSiblingUrl("not a url", "llmchat-x--y.meetploy.app")).toBe(
			"not a url",
		);
	});
});
