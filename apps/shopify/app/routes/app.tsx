import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { getShopify, getShopifyEnv } from "../shopify.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	await getShopify(context).authenticate.admin(request);

	return { apiKey: getShopifyEnv(context).SHOPIFY_API_KEY || "" };
};

export default function App() {
	const { apiKey } = useLoaderData<typeof loader>();

	return (
		<AppProvider embedded apiKey={apiKey}>
			<s-app-nav>
				<s-link href="/app">Home</s-link>
			</s-app-nav>
			<Outlet />
		</AppProvider>
	);
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
	return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
	return boundary.headers(headersArgs);
};
