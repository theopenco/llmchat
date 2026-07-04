import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { getShopify } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	await getShopify(context).authenticate.admin(request);

	return null;
};

export const headers: HeadersFunction = (headersArgs) => {
	return boundary.headers(headersArgs);
};
