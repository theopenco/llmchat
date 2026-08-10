import { describe, expect, it, vi } from "vitest";

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

describe("createAuthRateLimitStorage", () => {
	it("round-trips a bucket through STATE under a namespaced key", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		const storage = createAuthRateLimitStorage(env);

		expect(await storage.get("ip:/sign-in")).toBeNull();
		await storage.set("ip:/sign-in", {
			key: "ip:/sign-in",
			count: 2,
			lastRequest: 1000,
		});

		// Namespaced so it never collides with the widget limiter's `ratelimit:` keys.
		expect([...store.keys()]).toEqual(["authrl:ip:/sign-in"]);
		expect(await storage.get("ip:/sign-in")).toEqual({
			key: "ip:/sign-in",
			count: 2,
			lastRequest: 1000,
		});
	});

	it("FAILS CLOSED: a STATE read error yields an over-limit bucket so Better Auth denies (429)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const storage = createAuthRateLimitStorage(envWithBrokenStore());

		// Better Auth keys buckets as `${ip}|${path}`.
		const bucket = await storage.get("203.0.113.9|/sign-in");
		// Any positive `max` is <= MAX_SAFE_INTEGER and lastRequest is "now", so
		// Better Auth's shouldRateLimit() sees count >= max within the window → 429.
		expect(bucket).not.toBeNull();
		expect(bucket!.count).toBe(Number.MAX_SAFE_INTEGER);
		errorSpy.mockRestore();
	});

	it("fails OPEN for the session read only: a STATE read error on /get-session returns null (no synthetic 429)", async () => {
		// A fail-closed 429 on get-session presents as a spontaneous sign-out on
		// every open dashboard (the Better Auth client nulls its session store on
		// any failed refetch) — availability wins for this one read.
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const storage = createAuthRateLimitStorage(envWithBrokenStore());

		expect(await storage.get("203.0.113.9|/get-session")).toBeNull();
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

	it("swallows STATE write errors (the deny already happened on read)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const storage = createAuthRateLimitStorage(envWithBrokenStore());
		await expect(
			storage.set("k", { key: "k", count: 1, lastRequest: 1 }),
		).resolves.toBeUndefined();
		errorSpy.mockRestore();
	});

	it("treats a malformed stored value as a fresh window (not an outage)", async () => {
		const store = new Map<string, string>([["authrl:k", "{not json"]]);
		const storage = createAuthRateLimitStorage(envWithStore(store));
		expect(await storage.get("k")).toBeNull();
	});
});
