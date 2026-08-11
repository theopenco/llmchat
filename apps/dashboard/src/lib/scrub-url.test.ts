import { describe, expect, it } from "vitest";

import { isSecretPath, scrubUrl } from "./scrub-url";

// docs/goals/invites.md R5 + amendment A1: the invite token rides the link
// only. The dashboard sends $current_url on every pageview and autocapture
// event, so /invite/<token> is the one route where a URL is a credential.
describe("scrubUrl — the invite token never reaches analytics", () => {
	const TOKEN = "s3cr3t-Bearer_TOKEN-value-abcdefghijklmnop";

	it("redacts the token from an invite URL", () => {
		const scrubbed = scrubUrl(`https://app.clankersupport.com/invite/${TOKEN}`);
		expect(scrubbed).not.toContain(TOKEN);
		expect(scrubbed).toBe("https://app.clankersupport.com/invite/[redacted]");
	});

	it("keeps query and hash structure while dropping the token", () => {
		for (const [input, expected] of [
			[`/invite/${TOKEN}?ref=email`, "/invite/[redacted]?ref=email"],
			[`/invite/${TOKEN}#top`, "/invite/[redacted]#top"],
			[`/invite/${TOKEN}/`, "/invite/[redacted]/"],
		] as const) {
			const scrubbed = scrubUrl(input);
			expect(scrubbed).toBe(expected);
			expect(scrubbed).not.toContain(TOKEN);
		}
	});

	it("leaves ordinary dashboard URLs untouched", () => {
		for (const url of [
			"https://app.clankersupport.com/inbox",
			"https://app.clankersupport.com/settings/projects/p_123?tab=members",
			"/inbox#conversation-9",
		]) {
			expect(scrubUrl(url)).toBe(url);
		}
	});

	it("is total — no input shape throws", () => {
		for (const url of ["", "/invite/", "not a url", "/invite"]) {
			expect(() => scrubUrl(url)).not.toThrow();
			expect(scrubUrl(url)).not.toContain("undefined");
		}
	});

	it("flags the invite route as secret-bearing", () => {
		expect(isSecretPath("/invite/abc")).toBe(true);
		expect(isSecretPath("/inbox")).toBe(false);
	});
});
