// Web-streams SSR (workerd port): react-dom/server.edge is imported by
// explicit subpath because "react-dom/server" resolves to the Node build
// (renderToPipeableStream) under any bundler that doesn't set the `workerd`
// condition — including Ploy's deploy-time esbuild. The .edge build's
// renderToReadableStream runs on workerd AND Node >= 18, so `shopify app dev`
// keeps working too.
import { renderToReadableStream } from "react-dom/server.edge";
import { ServerRouter } from "react-router";
import type { AppLoadContext, EntryContext } from "react-router";
import { isbot } from "isbot";
import { getShopify } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	reactRouterContext: EntryContext,
	loadContext: AppLoadContext,
) {
	getShopify(loadContext).addDocumentResponseHeaders(request, responseHeaders);

	const controller = new AbortController();
	// Give React streamTimeout + 1s to flush rejected boundary contents, then abort.
	setTimeout(() => controller.abort(), streamTimeout + 1000);

	let statusCode = responseStatusCode;
	const body = await renderToReadableStream(
		<ServerRouter context={reactRouterContext} url={request.url} />,
		{
			signal: controller.signal,
			onError(error: unknown) {
				statusCode = 500;
				console.error(error);
			},
		},
	);

	// Bots get the fully rendered document (SEO/embed checks), humans stream.
	if (isbot(request.headers.get("user-agent") ?? "")) {
		await body.allReady;
	}

	responseHeaders.set("Content-Type", "text/html");
	return new Response(body, {
		headers: responseHeaders,
		status: statusCode,
	});
}
