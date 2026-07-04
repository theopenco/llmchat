import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const shopify = getShopify(context);
	const { shop, session, topic } = await shopify.authenticate.webhook(request);

	console.log(`Received ${topic} webhook for ${shop}`);

	// Webhook requests can trigger multiple times and after an app has already been uninstalled.
	// If this webhook already ran, the session may have been deleted previously.
	if (session) {
		const sessions =
			(await shopify.sessionStorage.findSessionsByShop?.(shop)) ?? [];
		if (sessions.length > 0) {
			await shopify.sessionStorage.deleteSessions?.(sessions.map((s) => s.id));
		}
	}

	return new Response();
};
