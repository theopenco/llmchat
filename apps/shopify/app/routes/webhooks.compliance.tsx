import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Multiplexed GDPR compliance route (docs/shopify-app-plan.md §7): all three
 * mandatory topics arrive here; the topic rides in X-Shopify-Topic.
 *
 * `authenticate.webhook()` verifies the HMAC over the raw body and THROWS a
 * 401 Response on mismatch — the automated review probe (garbage HMAC → 401)
 * passes before any handler code runs. Do not wrap it in try/catch.
 *
 * Complete inventory of what this app stores, anywhere: Session rows
 * (shop domain + access token — shop-level, no personal data) and the Clanker
 * project key (an app-data metafield, on Shopify's side). End-user support
 * conversations never touch this server — visitors talk browser →
 * api.clankersupport.com directly, and merchants manage that data in their
 * Clanker dashboard.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
	const { shop, topic, payload } = await authenticate.webhook(request);

	console.log(`Received ${topic} webhook for ${shop}`);

	switch (topic) {
		case "CUSTOMERS_DATA_REQUEST":
		case "CUSTOMERS_REDACT":
			// We hold zero customer data — nothing to export, nothing to delete.
			// The app's privacy policy directs merchants to their Clanker
			// dashboard for conversation exports/deletion.
			break;
		case "SHOP_REDACT": {
			// Arrives ~48h after uninstall. Session rows are 100% of what we hold
			// for a shop; deleting them completes redaction well inside the
			// 30-day window.
			const shopDomain =
				(payload as { shop_domain?: string }).shop_domain ?? shop;
			await db.session.deleteMany({ where: { shop: shopDomain } });
			break;
		}
		default:
			break;
	}

	return new Response();
};
