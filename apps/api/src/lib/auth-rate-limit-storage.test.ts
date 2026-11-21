import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createAuthRateLimitStorage,
	mayFailOpen,
} from "./auth-rate-limit-storage";

import type { Env } from "@/env";

function envWithStore(store: Map<string, string>): Env {
	return {
		STATE: {
			get: vi.fn(async (key: string) => store.get(key) ?? null),
			set: vi.fn(async (key: string, value: string) => {
				store.set(key, value);
			}),
		},
	} as unknown as Env;
}

function envWithBrokenStore(): Env {
	return {
		STATE: {
			get: vi.fn(async () => {
				throw new Error("state unavailable");
			}),
			set: vi.fn(async () => {
				throw new Error("state unavailable");
			}),
		},
	} as unknown as Env;
}

const RULE = { window: 10, max: 3 };

describe("createAuthRateLimitStorage", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("allows up to max requests per window, then denies with a retry-after", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000);
		const store = new Map<string, string>();
		const storage = createAuthRateLimitStorage(envWithStore(store));

		for (let i = 0; i < RULE.max; i++) {
			expect(await storage.consume("ip|/sign-in", RULE)).toEqual({
				allowed: true,
				retryAfter: null,
			});
		}
		vi.setSystemTime(1_004_000);
		expect(await storage.consume("ip|/sign-in", RULE)).toEqual({
			allowed: false,
			retryAfter: 6,
		});

		// Namespaced so it never collides with the widget limiter's `ratelimit:` keys.
		expect([...store.keys()]).toEqual(["authrl:ip|/sign-in"]);
	});

	it("resets the bucket once the window has elapsed since the last request", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(2_000_000);
		const store = new Map<string, string>();
		const storage = createAuthRateLimitStorage(envWithStore(store));
		for (let i = 0; i < RULE.max; i++) await storage.consume("k", RULE);
		expect((await storage.consume("k", RULE)).allowed).toBe(false);

		vi.setSystemTime(2_000_000 + RULE.window * 1000);
		expect(await storage.consume("k", RULE)).toEqual({
			allowed: true,
			retryAfter: null,
		});
		expect(JSON.parse(store.get("authrl:k")!)).toEqual({
			count: 1,
			lastRequest: 2_000_000 + RULE.window * 1000,
		});
	});

	it("FAILS CLOSED: a STATE read error denies the attempt (429)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const storage = createAuthRateLimitStorage(envWithBrokenStore());

		// Better Auth keys buckets as `${ip}|${path}`.
		expect(await storage.consume("203.0.113.9|/sign-in", RULE)).toEqual({
			allowed: false,
			retryAfter: RULE.window,
		});
		errorSpy.mockRestore();
	});

	it("fails OPEN for the session read only: a STATE read error on /get-session is allowed", async () => {
		// A fail-closed 429 on get-session presents as a spontaneous sign-out on
		// every open dashboard (the Better Auth client nulls its session store on
		// any failed refetch) — availability wins for this one read.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const storage = createAuthRateLimitStorage(envWithBrokenStore());

		expect(await storage.consume("203.0.113.9|/get-session", RULE)).toEqual({
			allowed: true,
			retryAfter: null,
		});
		// The outage is still logged — fail-open must never be silent.
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("mayFailOpen recognizes exactly the get-session path suffix — anything else (or an unknown key shape) stays fail-closed", () => {
		expect(mayFailOpen("203.0.113.9|/get-session")).toBe(true);
		expect(mayFailOpen("203.0.113.9|/sign-in")).toBe(false);
		expect(mayFailOpen("203.0.113.9|/sign-in/email")).toBe(false);
		expect(mayFailOpen("203.0.113.9|/change-password")).toBe(false);
		// A future key-format change must degrade toward MORE denial, never
		// toward an open credential path.
		expect(mayFailOpen("/get-session")).toBe(false);
		expect(mayFailOpen("203.0.113.9|/get-session/extra")).toBe(false);
		expect(mayFailOpen("203.0.113.9")).toBe(false);
	});

	it("swallows STATE write errors so an allowed request never 500s", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const env = {
			STATE: {
				get: vi.fn(async () => null),
				set: vi.fn(async () => {
					throw new Error("state unavailable");
				}),
			},
		} as unknown as Env;
		await expect(
			createAuthRateLimitStorage(env).consume("k", RULE),
		).resolves.toEqual({ allowed: true, retryAfter: null });
		errorSpy.mockRestore();
	});

	it("treats a malformed stored value as a fresh window (not an outage)", async () => {
		const store = new Map<string, string>([["authrl:k", "{not json"]]);
		const storage = createAuthRateLimitStorage(envWithStore(store));
		expect(await storage.consume("k", RULE)).toEqual({
			allowed: true,
			retryAfter: null,
		});
	});
});
