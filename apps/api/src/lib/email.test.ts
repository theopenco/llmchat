import { describe, expect, it } from "vitest";

import { buildReplyToAddress, escapeHtml } from "./email";

import type { Env } from "@/env";

describe("escapeHtml", () => {
	it("escapes every HTML-significant character", () => {
		expect(escapeHtml(`<b a="x" b='y'>&</b>`)).toBe(
			"&lt;b a=&quot;x&quot; b=&#x27;y&#x27;&gt;&amp;&lt;/b&gt;",
		);
	});

	it("escapes ampersands first so entities are not double-decoded", () => {
		expect(escapeHtml("&lt;")).toBe("&amp;lt;");
	});

	it("passes plain text through unchanged", () => {
		expect(escapeHtml("hello world")).toBe("hello world");
	});
});

describe("buildReplyToAddress", () => {
	it("builds the reply+<local>@<domain> address", () => {
		const env = {
			vars: { INBOUND_EMAIL_DOMAIN: "mail.example.com" },
		} as unknown as Env;
		expect(buildReplyToAddress(env, "dev")).toBe("reply+dev@mail.example.com");
	});

	it("returns undefined when the inbound domain is unset", () => {
		const env = { vars: {} } as unknown as Env;
		expect(buildReplyToAddress(env, "dev")).toBeUndefined();
	});

	it("returns undefined when the inbound domain is empty/whitespace", () => {
		const env = { vars: { INBOUND_EMAIL_DOMAIN: "   " } } as unknown as Env;
		expect(buildReplyToAddress(env, "dev")).toBeUndefined();
	});

	it("returns undefined for an unexpanded $VAR domain", () => {
		const env = {
			vars: { INBOUND_EMAIL_DOMAIN: "$INBOUND_EMAIL_DOMAIN" },
		} as unknown as Env;
		expect(buildReplyToAddress(env, "dev")).toBeUndefined();
	});

	it("returns undefined when the project local part is missing", () => {
		const env = {
			vars: { INBOUND_EMAIL_DOMAIN: "mail.example.com" },
		} as unknown as Env;
		expect(buildReplyToAddress(env, "")).toBeUndefined();
		expect(buildReplyToAddress(env, null)).toBeUndefined();
		expect(buildReplyToAddress(env, undefined)).toBeUndefined();
	});
});
