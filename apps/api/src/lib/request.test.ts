import { describe, expect, it } from "vitest";

import { clientIp, trustedIpHeaders } from "./request";

import type { Env } from "@/env";

function ctx(
	headers: Record<string, string | undefined>,
	vars?: Partial<Env["vars"]>,
) {
	return {
		req: { header: (n: string) => headers[n.toLowerCase()] },
		env: vars ? ({ vars } as Env) : undefined,
	};
}

describe("clientIp", () => {
	it("reads the default trusted header (cf-connecting-ip)", () => {
		expect(clientIp(ctx({ "cf-connecting-ip": "9.9.9.9" }))).toBe("9.9.9.9");
	});

	it("does NOT fall back to a spoofable x-forwarded-for", () => {
		// The whole point of the hardening: an attacker-set x-forwarded-for must not
		// become the rate-limit key when the trusted header is absent.
		expect(clientIp(ctx({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
			"unknown",
		);
	});

	it("honors the TRUSTED_CLIENT_IP_HEADER override", () => {
		expect(
			clientIp(
				ctx(
					{ "x-real-ip": "7.7.7.7", "cf-connecting-ip": "9.9.9.9" },
					{ TRUSTED_CLIENT_IP_HEADER: "x-real-ip" },
				),
			),
		).toBe("7.7.7.7");
	});

	it("trims, and falls back to 'unknown' when the trusted header is missing", () => {
		expect(clientIp(ctx({ "cf-connecting-ip": "  4.4.4.4 " }))).toBe("4.4.4.4");
		expect(clientIp(ctx({}))).toBe("unknown");
	});
});

describe("trustedIpHeaders (for Better Auth getIp)", () => {
	it("is exactly the one trusted header — never x-forwarded-for", () => {
		expect(trustedIpHeaders()).toEqual(["cf-connecting-ip"]);
		expect(
			trustedIpHeaders({
				vars: { TRUSTED_CLIENT_IP_HEADER: "x-real-ip" },
			} as Env),
		).toEqual(["x-real-ip"]);
	});
});
