import { describe, expect, test } from "vitest";

import { getShopifyEnv } from "./shopify.server";

describe("getShopifyEnv", () => {
	test("unnests Ploy prod env vars from env.vars (bindings stay flat)", () => {
		const sessionDb = { fake: "d1" };
		const context = {
			cloudflare: {
				env: {
					SESSION_DB: sessionDb,
					vars: {
						SHOPIFY_APP_URL: "https://shopify.clankersupport.com",
						SHOPIFY_API_KEY: "key123",
					},
				},
			},
		};

		const env = getShopifyEnv(context);
		expect(env.SHOPIFY_APP_URL).toBe("https://shopify.clankersupport.com");
		expect(env.SHOPIFY_API_KEY).toBe("key123");
		expect(env.SESSION_DB).toBe(sessionDb);
	});

	test("passes a flat wrangler-dev env through unchanged", () => {
		const context = {
			cloudflare: {
				env: {
					SHOPIFY_APP_URL: "http://localhost:3006",
					SCOPES: "",
				},
			},
		};

		const env = getShopifyEnv(context);
		expect(env.SHOPIFY_APP_URL).toBe("http://localhost:3006");
	});

	test("falls back to process.env without a cloudflare context", () => {
		expect(getShopifyEnv(undefined)).toBe(process.env);
	});
});
