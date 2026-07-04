/**
 * Dual-dialect KV facade for @shopify/shopify-app-session-storage-kv.
 *
 * KVSessionStorage speaks the Cloudflare KVNamespace dialect: `put(key, str)`,
 * `get(key, "json" | { type: "json" })`, `delete(key)`. Ploy's DEPLOYED
 * `state:` binding is only KV-*compatible*: it exposes `get`/`set` and no
 * `put` (empirically documented in apps/api/src/lib/kv.ts — the api's rate
 * limiter was rewritten around the same gap). Local dev (wrangler/miniflare)
 * is real KV, which would mask the mismatch until production.
 *
 * This facade maps the adapter's calls onto whichever dialect the binding
 * actually speaks, so the same code runs under miniflare AND deployed Ploy.
 */

export interface StateBindingLike {
	get(key: string): Promise<unknown>;
	set?(key: string, value: string): Promise<unknown>;
	put?(key: string, value: string, options?: unknown): Promise<unknown>;
	delete(key: string): Promise<unknown>;
}

function wantsJson(typeOrOptions: unknown): boolean {
	if (typeOrOptions === "json") return true;
	return (
		typeof typeOrOptions === "object" &&
		typeOrOptions !== null &&
		(typeOrOptions as { type?: string }).type === "json"
	);
}

export function toSessionKvNamespace(binding: StateBindingLike) {
	return {
		async get(key: string, typeOrOptions?: unknown): Promise<unknown> {
			const raw = await binding.get(key);
			if (raw === null || raw === undefined) return null;
			if (!wantsJson(typeOrOptions)) return raw;
			// A document-store binding may hand back an already-parsed value;
			// real KV hands back the stored string.
			return typeof raw === "string" ? JSON.parse(raw) : raw;
		},
		async put(key: string, value: string): Promise<void> {
			if (typeof binding.put === "function") {
				await binding.put(key, value);
				return;
			}
			if (typeof binding.set !== "function") {
				throw new Error(
					"SESSION_STORAGE binding exposes neither put() nor set()",
				);
			}
			await binding.set(key, value);
		},
		async delete(key: string): Promise<void> {
			await binding.delete(key);
		},
	};
}
