import { describe, expect, it, vi } from "vitest";

import { clientIp, rateLimitSubject, trustedIpHeaders } from "./request";

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

describe("rateLimitSubject", () => {
	it("uses the real IP when present (normal case — unchanged bucket key)", () => {
		expect(rateLimitSubject("9.9.9.9", "client-1")).toBe("9.9.9.9");
	});

	it("falls back to the per-clientId bucket when the IP is unknown (header misconfig)", () => {
		// The whole point: a misconfig must NOT collapse every visitor into one
		// shared `…:unknown` bucket (the earlier outage). Each visitor keeps a bucket.
		expect(rateLimitSubject("unknown", "client-1")).toBe("c:client-1");
		expect(rateLimitSubject("unknown", "client-2")).toBe("c:client-2");
	});

	it("collapses to 'unknown' only when BOTH the IP and the clientId are missing", () => {
		expect(rateLimitSubject("unknown", "")).toBe("unknown");
		expect(rateLimitSubject("", "")).toBe("unknown");
	});
});

describe("clientIp — missing-trusted-header alarm", () => {
	const prodEnv = {
		vars: { DASHBOARD_URL: "https://app.clankersupport.com" },
	} as Env;

	it("does NOT warn in local dev (DASHBOARD_URL is localhost)", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const localEnv = {
			vars: { DASHBOARD_URL: "http://localhost:3001" },
		} as Env;
		expect(clientIp({ req: { header: () => undefined }, env: localEnv })).toBe(
			"unknown",
		);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("does NOT warn when the trusted header is present in prod", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(clientIp({ req: { header: () => "9.9.9.9" }, env: prodEnv })).toBe(
			"9.9.9.9",
		);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("warns LOUDLY exactly once per isolate when the header is missing in prod", async () => {
		// Fresh module instance so the per-isolate dedup flag starts clean.
		vi.resetModules();
		const { clientIp: freshClientIp } = await import("./request");
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const ctxMissing = { req: { header: () => undefined }, env: prodEnv };
		expect(freshClientIp(ctxMissing)).toBe("unknown");
		expect(freshClientIp(ctxMissing)).toBe("unknown");
		// Deduped — an outage must not also spam the logs every request.
		expect(spy).toHaveBeenCalledTimes(1);
		expect(String(spy.mock.calls[0]?.[0])).toContain("cf-connecting-ip");
		spy.mockRestore();
	});
});
