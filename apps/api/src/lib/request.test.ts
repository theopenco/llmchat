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
	it("reads the default trusted header (x-real-ip — Ploy's forwarded client IP)", () => {
		expect(clientIp(ctx({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
	});

	it("ignores cf-connecting-ip by default (no longer the baked-in header)", () => {
		// The durable fix: the default now matches our infra (Ploy/x-real-ip), so a
		// deploy that lost TRUSTED_CLIENT_IP_HEADER no longer collapses to "unknown".
		expect(clientIp(ctx({ "cf-connecting-ip": "9.9.9.9" }))).toBe("unknown");
	});

	it("does NOT fall back to a spoofable x-forwarded-for", () => {
		// The whole point of the hardening: an attacker-set x-forwarded-for must not
		// become the rate-limit key when the trusted header is absent.
		expect(clientIp(ctx({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
			"unknown",
		);
	});

	it("honors the TRUSTED_CLIENT_IP_HEADER override (redirects away from the default)", () => {
		// Override to cf-connecting-ip: proves the override still works by picking it
		// over the now-default x-real-ip (a different host can still configure it).
		expect(
			clientIp(
				ctx(
					{ "x-real-ip": "7.7.7.7", "cf-connecting-ip": "9.9.9.9" },
					{ TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" },
				),
			),
		).toBe("9.9.9.9");
	});

	it("trims, and falls back to 'unknown' when the trusted header is missing", () => {
		expect(clientIp(ctx({ "x-real-ip": "  4.4.4.4 " }))).toBe("4.4.4.4");
		expect(clientIp(ctx({}))).toBe("unknown");
	});
});

describe("trustedIpHeaders (for Better Auth getIp)", () => {
	it("is exactly the one trusted header — never x-forwarded-for", () => {
		expect(trustedIpHeaders()).toEqual(["x-real-ip"]);
		expect(
			trustedIpHeaders({
				vars: { TRUSTED_CLIENT_IP_HEADER: "cf-connecting-ip" },
			} as Env),
		).toEqual(["cf-connecting-ip"]);
	});
});
