import type { ActionFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
	const shopify = getShopify(context);
	const { payload, session, topic, shop } =
		await shopify.authenticate.webhook(request);
	console.log(`Received ${topic} webhook for ${shop}`);

	const current = payload.current as string[];
	if (session) {
		session.scope = current.toString();
		await shopify.sessionStorage.storeSession(session);
	}
	return new Response();
};
