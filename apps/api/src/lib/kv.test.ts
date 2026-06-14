import { describe, expect, it, vi } from "vitest";

import { rateLimit } from "./kv";

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

	it("fails open when the state store throws", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await rateLimit(envWithBrokenStore(), "k", 5, 60);
		expect(result.ok).toBe(true);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
