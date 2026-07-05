import type { Shopify } from "../shopify.server";

/**
 * Find-then-delete every stored session for a shop — the shared cleanup shape
 * for app/uninstalled and shop/redact. findSessionsByShop/deleteSessions are
 * optional on the SessionStorage interface; both storages this app uses (KV,
 * memory) implement them, and a no-op on absence is the safe direction for a
 * webhook handler (200 = handled; Shopify must not retry forever).
 */
export async function deleteShopSessions(
	shopify: Shopify,
	shop: string,
): Promise<void> {
	const sessions =
		(await shopify.sessionStorage.findSessionsByShop?.(shop)) ?? [];
	if (sessions.length > 0) {
		await shopify.sessionStorage.deleteSessions?.(sessions.map((s) => s.id));
	}
}
