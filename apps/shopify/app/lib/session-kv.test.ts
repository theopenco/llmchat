import { describe, expect, it } from "vitest";
// Session is re-exported by the framework package (@shopify/shopify-api is a
// transitive dep pnpm's strict layout won't let us import directly).
import { Session } from "@shopify/shopify-app-react-router/server";
import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { toSessionKvNamespace, type StateBindingLike } from "./session-kv";

// Real-KV dialect: put/get/delete, get returns the stored string.
function fakeCloudflareKv(): StateBindingLike {
	const store = new Map<string, string>();
	return {
		get: async (key) => store.get(key) ?? null,
		put: async (key, value) => void store.set(key, value),
		delete: async (key) => void store.delete(key),
	};
}

// Deployed-Ploy dialect: get/set only — NO put (apps/api/src/lib/kv.ts).
function fakePloyState(): StateBindingLike {
	const store = new Map<string, string>();
	return {
		get: async (key) => store.get(key) ?? null,
		set: async (key, value) => void store.set(key, value),
		delete: async (key) => void store.delete(key),
	};
}

function session(id: string, shop: string): Session {
	return new Session({
		id,
		shop,
		state: "state",
		isOnline: false,
		accessToken: "token",
	});
}

// The REAL adapter runs against the facade over both dialects — this is the
// exact call surface production exercises (store → find-by-shop → delete).
for (const [dialect, makeBinding] of [
	["cloudflare-kv (put)", fakeCloudflareKv],
	["ploy-state (set, no put)", fakePloyState],
] as const) {
	describe(`KVSessionStorage over ${dialect}`, () => {
		it("stores, loads, finds by shop, and deletes a session", async () => {
			const storage = new KVSessionStorage(
				toSessionKvNamespace(makeBinding()) as never,
			);
			const s = session("offline_x.myshopify.com", "x.myshopify.com");

			expect(await storage.storeSession(s)).toBe(true);

			const loaded = await storage.loadSession(s.id);
			expect(loaded?.shop).toBe("x.myshopify.com");
			expect(loaded?.accessToken).toBe("token");

			const found = await storage.findSessionsByShop("x.myshopify.com");
			expect(found.map((f) => f.id)).toEqual([s.id]);

			await storage.deleteSessions([s.id]);
			expect(await storage.loadSession(s.id)).toBeUndefined();
			expect(await storage.findSessionsByShop("x.myshopify.com")).toEqual([]);
		});
	});
}

describe("toSessionKvNamespace", () => {
	it("throws loudly when the binding speaks neither dialect", async () => {
		const kv = toSessionKvNamespace({
			get: async () => null,
			delete: async () => {},
		});
		await expect(kv.put("k", "v")).rejects.toThrow(/neither put\(\) nor set/);
	});
});
