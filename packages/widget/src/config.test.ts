import { describe, expect, it } from "vitest";

import { resolveConfig } from "./config";

function scriptTag(attrs: Record<string, string>): HTMLScriptElement {
	const el = document.createElement("script");
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, value);
	}
	return el;
}

describe("resolveConfig", () => {
	it("throws without a project key", () => {
		expect(() => resolveConfig(null)).toThrow(/data-project/);
		expect(() => resolveConfig(scriptTag({}))).toThrow(/data-project/);
	});

	it("uses an explicit data-api when present", () => {
		const config = resolveConfig(
			scriptTag({
				src: "https://api.example.com/widget.js",
				"data-project": "pk",
				"data-api": "http://localhost:8787",
			}),
		);
		expect(config.apiUrl).toBe("http://localhost:8787");
	});

	it("falls back to the origin that served widget.js — NOT a hardcoded host", () => {
		// Regression: embeds without data-api used to silently call prod.
		const config = resolveConfig(
			scriptTag({
				src: "http://localhost:8787/widget.js",
				"data-project": "pk",
			}),
		);
		expect(config.apiUrl).toBe("http://localhost:8787");
	});

	it("falls back to the window origin when the script has no src (inline)", () => {
		const config = resolveConfig(scriptTag({ "data-project": "pk" }));
		expect(config.apiUrl).toBe(window.location.origin);
	});

	it("only accepts the documented inline mode value", () => {
		const inline = resolveConfig(
			scriptTag({ "data-project": "pk", "data-mode": "inline" }),
		);
		const typo = resolveConfig(
			scriptTag({ "data-project": "pk", "data-mode": "INLINE" }),
		);
		expect(inline.mode).toBe("inline");
		expect(typo.mode).toBe("bubble");
	});

	it("defaults the brand color", () => {
		expect(resolveConfig(scriptTag({ "data-project": "pk" })).brandColor).toBe(
			"#111827",
		);
	});
});
