import { describe, expect, it } from "vitest";

import {
	renderEmbedPage,
	safeBrandColor,
	safeEscalationThreshold,
	safeTheme,
} from "./embed-page";

const base = {
	projectName: "Acme",
	publicKey: "pk_123",
	brandColor: "#4f46e5",
	escalationThreshold: 3,
};

describe("safeBrandColor", () => {
	it("accepts 3/4/6/8-digit hex literals", () => {
		for (const value of ["#fff", "#fffa", "#4f46e5", "#4f46e5ff"]) {
			expect(safeBrandColor(value)).toBe(value);
		}
	});

	it("rejects anything that could break out of the attribute", () => {
		for (const value of [
			"",
			"red",
			'"><script>alert(1)</script>',
			"#fff; background:url(x)",
			"url(javascript:alert(1))",
		]) {
			expect(safeBrandColor(value)).toBe("#111827");
		}
	});
});

describe("renderEmbedPage", () => {
	it("escapes HTML in the project name (title injection)", () => {
		const html = renderEmbedPage({
			...base,
			projectName: "</title><script>alert(1)</script>",
		});
		expect(html).not.toContain("<script>alert(1)");
		expect(html).toContain("&lt;/title&gt;");
	});

	it("escapes attribute-breaking characters in the public key", () => {
		const html = renderEmbedPage({
			...base,
			publicKey: '" onload="alert(1)',
		});
		expect(html).toContain("&quot; onload=&quot;alert(1)");
		// exactly one script element — nothing injected a second one
		expect(html.match(/<script /g)).toHaveLength(1);
	});

	it("loads widget.js relative to its own origin and mounts inline", () => {
		const html = renderEmbedPage(base);
		// Relative on purpose: an absolute url built from the request would
		// carry http:// behind the TLS-terminating proxy and get CSP-blocked.
		expect(html).toContain('src="/widget.js"');
		expect(html).not.toContain("data-api");
		expect(html).toContain('data-mode="inline"');
	});

	it("falls back to the default brand for a malicious brand color", () => {
		const html = renderEmbedPage({
			...base,
			brandColor: '#fff" onload="x',
		});
		expect(html).toContain('data-brand="#111827"');
		expect(html).not.toContain('onload="x');
	});

	it("emits the escalation threshold as a data attribute", () => {
		expect(renderEmbedPage({ ...base, escalationThreshold: 5 })).toContain(
			'data-escalation-threshold="5"',
		);
	});

	it("clamps an invalid threshold to the default", () => {
		expect(renderEmbedPage({ ...base, escalationThreshold: 0 })).toContain(
			'data-escalation-threshold="3"',
		);
	});
});

describe("safeEscalationThreshold", () => {
	it("keeps positive integers and falls back otherwise", () => {
		expect(safeEscalationThreshold(5)).toBe(5);
		expect(safeEscalationThreshold(1)).toBe(1);
		expect(safeEscalationThreshold(0)).toBe(3);
		expect(safeEscalationThreshold(-2)).toBe(3);
		expect(safeEscalationThreshold(2.5)).toBe(3);
	});
});

describe("embed theme passthrough", () => {
	it("safeTheme constrains to the widget vocabulary (default light)", () => {
		expect(safeTheme("dark")).toBe("dark");
		expect(safeTheme("auto")).toBe("auto");
		expect(safeTheme("light")).toBe("light");
		expect(safeTheme(undefined)).toBe("light");
		expect(safeTheme('"><script>')).toBe("light");
	});

	it("emits data-theme and a matching dark page background", () => {
		const html = renderEmbedPage({ ...base, theme: "dark" });
		expect(html).toContain('data-theme="dark"');
		expect(html).toContain("background:#111827");
	});

	it("auto keeps a light background with a prefers-color-scheme override", () => {
		const html = renderEmbedPage({ ...base, theme: "auto" });
		expect(html).toContain('data-theme="auto"');
		expect(html).toContain("@media (prefers-color-scheme: dark)");
	});

	it("defaults to light with the original white background", () => {
		const html = renderEmbedPage({ ...base });
		expect(html).toContain('data-theme="light"');
		expect(html).toContain("background:#fff");
	});
});
