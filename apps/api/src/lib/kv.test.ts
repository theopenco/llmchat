import { describe, expect, it, vi } from "vitest";

import { publicLookupRateLimit, rateLimit, shouldSendHolding } from "./kv";

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
				throw new Error("state binding unavailable");
			}),
			set: vi.fn(async () => {
				throw new Error("state binding unavailable");
			}),
		},
	} as unknown as Env;
}

describe("rateLimit", () => {
	it("counts up and blocks past the max", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		expect((await rateLimit(env, "k", 2, 60)).ok).toBe(true);
		expect((await rateLimit(env, "k", 2, 60)).ok).toBe(true);
		expect((await rateLimit(env, "k", 2, 60)).ok).toBe(false);
	});

	it("tracks keys independently", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		await rateLimit(env, "a", 1, 60);
		expect((await rateLimit(env, "a", 1, 60)).ok).toBe(false);
		expect((await rateLimit(env, "b", 1, 60)).ok).toBe(true);
	});

	it("fails OPEN by default when the state store throws (public widget path)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await rateLimit(envWithBrokenStore(), "k", 5, 60);
		expect(result.ok).toBe(true);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("fails CLOSED when failClosed is set and the state store throws", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await rateLimit(envWithBrokenStore(), "k", 5, 60, {
			failClosed: true,
		});
		expect(result.ok).toBe(false);
		expect(result.remaining).toBe(0);
		errorSpy.mockRestore();
	});
});

describe("shouldSendHolding", () => {
	it("sends on the first turn, then stays quiet within the cooldown window", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		expect(await shouldSendHolding(env, "c1")).toBe(true); // first → send
		expect(await shouldSendHolding(env, "c1")).toBe(false); // within ~5min → quiet
		expect([...store.keys()][0]).toBe("holdmsg:c1");
	});

	it("throttles per conversation independently", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		await shouldSendHolding(env, "c1");
		expect(await shouldSendHolding(env, "c1")).toBe(false);
		expect(await shouldSendHolding(env, "c2")).toBe(true); // different conv → send
	});

	it("sends again once the cooldown window elapses", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
			const store = new Map<string, string>();
			const env = envWithStore(store);
			expect(await shouldSendHolding(env, "c1")).toBe(true);
			expect(await shouldSendHolding(env, "c1")).toBe(false);
			vi.setSystemTime(new Date("2026-01-01T00:06:00Z")); // +6min > 5min cooldown
			expect(await shouldSendHolding(env, "c1")).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it("fails OPEN toward sending when STATE is unavailable (reassure, not dead-air)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await shouldSendHolding(envWithBrokenStore(), "c1")).toBe(true);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe("publicLookupRateLimit", () => {
	it("bounds per-IP pre-lookup volume and stays open on a STATE outage", async () => {
		const store = new Map<string, string>();
		const env = envWithStore(store);
		// Same IP many times stays ok until the (generous) cap; the point is it's
		// keyed per IP and bounded, not that it trips at a low number.
		expect((await publicLookupRateLimit(env, "1.1.1.1")).ok).toBe(true);
		expect([...store.keys()][0]).toBe("ratelimit:pubkey:1.1.1.1");

		// Public path → fail OPEN when STATE is down (never take the widget offline).
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(
			(await publicLookupRateLimit(envWithBrokenStore(), "1.1.1.1")).ok,
		).toBe(true);
		errorSpy.mockRestore();
	});
});
