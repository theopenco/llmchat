import { describe, expect, it } from "vitest";

import {
	embedUrl,
	widgetIframeSnippet,
	widgetScriptSnippet,
} from "./embed-snippets";

const base = {
	apiUrl: "https://api.example.com",
	publicKey: "pk_123",
	brandColor: "#4f46e5",
};

describe("embedUrl", () => {
	it("builds the /embed page url for the project key", () => {
		expect(embedUrl(base)).toBe("https://api.example.com/embed/pk_123");
	});

	it("strips trailing slashes from the api url", () => {
		expect(embedUrl({ ...base, apiUrl: "https://api.example.com//" })).toBe(
			"https://api.example.com/embed/pk_123",
		);
	});

	it("url-encodes keys so they cannot break out of the path", () => {
		expect(embedUrl({ ...base, publicKey: 'a/b?c="x"' })).toBe(
			"https://api.example.com/embed/a%2Fb%3Fc%3D%22x%22",
		);
	});
});

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

	it("is a formatted multi-line tag with editable sizing attributes", () => {
		const snippet = widgetIframeSnippet(base);
		const lines = snippet.split("\n");
		expect(lines[0]).toBe("<iframe");
		expect(lines.at(-1)).toBe("></iframe>");
		expect(snippet).toContain('width="400"');
		expect(snippet).toContain('height="600"');
		expect(snippet).toContain('allow="clipboard-write"');
		expect(snippet).toContain('loading="lazy"');
	});
});
