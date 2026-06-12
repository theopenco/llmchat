import { describe, expect, it } from "vitest";

import { widgetIframeSnippet, widgetScriptSnippet } from "./embed-snippets";

const base = {
	apiUrl: "https://api.example.com",
	publicKey: "pk_123",
	brandColor: "#4f46e5",
};

describe("widgetScriptSnippet", () => {
	it("produces the documented script tag", () => {
		expect(widgetScriptSnippet(base)).toBe(
			'<script src="https://api.example.com/widget.js" data-project="pk_123" data-brand="#4f46e5" async></script>',
		);
	});

	it("strips trailing slashes from the api url", () => {
		expect(
			widgetScriptSnippet({ ...base, apiUrl: "https://api.example.com//" }),
		).toContain('src="https://api.example.com/widget.js"');
	});

	it("escapes attribute-breaking characters in interpolated values", () => {
		const snippet = widgetScriptSnippet({
			...base,
			publicKey: '" onload="alert(1)',
			brandColor: '#fff"><script>',
		});
		expect(snippet).not.toContain('""');
		expect(snippet).toContain("&quot; onload=&quot;alert(1)");
		expect(snippet).toContain("#fff&quot;&gt;&lt;script&gt;");
		// the only raw quotes left are the attribute delimiters
		expect(snippet.match(/<script /g)).toHaveLength(1);
	});
});

describe("widgetIframeSnippet", () => {
	it("points at the /embed page for the project key", () => {
		expect(widgetIframeSnippet(base)).toContain(
			'src="https://api.example.com/embed/pk_123"',
		);
	});

	it("url-encodes keys so they cannot break out of the path or attribute", () => {
		const snippet = widgetIframeSnippet({
			...base,
			publicKey: 'a/b?c="x"',
		});
		expect(snippet).toContain("/embed/a%2Fb%3Fc%3D%22x%22");
		expect(snippet).not.toContain('=""x""');
	});

	it("strips trailing slashes from the api url", () => {
		expect(
			widgetIframeSnippet({ ...base, apiUrl: "https://api.example.com/" }),
		).toContain('src="https://api.example.com/embed/pk_123"');
	});

	it("is a self-contained iframe with sizing the user can edit", () => {
		const snippet = widgetIframeSnippet(base);
		expect(snippet).toMatch(/^<iframe /);
		expect(snippet).toMatch(/<\/iframe>$/);
		expect(snippet).toContain("width: 400px");
		expect(snippet).toContain("height: 600px");
	});
});
