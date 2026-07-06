import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ShopifyError,
	shopifyCreateReturn,
	shopifyLookupOrder,
	shopifyReturnableItems,
} from "./shopify-admin";

import type { ShopifyConfig } from "@llmchat/shared";

const CFG: ShopifyConfig = {
	shopDomain: "acme-tools.myshopify.com",
	accessToken: "shpat_test",
};

const ORDER_NODE = {
	id: "gid://shopify/Order/1",
	name: "#1001",
	email: "ada@example.com",
	createdAt: "2026-06-20T00:00:00Z",
	displayFinancialStatus: "PAID",
	displayFulfillmentStatus: "FULFILLED",
	totalPriceSet: { shopMoney: { amount: "49.00", currencyCode: "USD" } },
	lineItems: { nodes: [{ title: "Wrench", quantity: 2 }] },
	fulfillments: [
		{
			trackingInfo: [
				{ number: "TRK1", url: "https://t.example/TRK1", company: "UPS" },
			],
		},
	],
};

function stubGraphql(data: unknown, status = 200) {
	const calls: { url: string; body: { query: string; variables: never } }[] =
		[];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init: RequestInit) => {
			calls.push({ url, body: JSON.parse(init.body as string) });
			return new Response(JSON.stringify({ data }), { status });
		}),
	);
	return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("shopifyLookupOrder", () => {
	it("queries by order name AND email with the access token header", async () => {
		const calls = stubGraphql({ orders: { nodes: [ORDER_NODE] } });
		const order = await shopifyLookupOrder(CFG, {
			orderNumber: "#1001",
			email: "Ada@Example.com",
		});
		expect(calls[0]!.url).toBe(
			"https://acme-tools.myshopify.com/admin/api/2025-01/graphql.json",
		);
		expect((calls[0]!.body.variables as { q: string }).q).toBe(
			"name:#1001 AND email:ada@example.com",
		);
		expect(order?.name).toBe("#1001");
		expect(order?.total).toBe("49.00");
		expect(order?.tracking[0]?.number).toBe("TRK1");
	});

	it("returns null when the order email does not match (guessable numbers must not leak)", async () => {
		stubGraphql({
			orders: { nodes: [{ ...ORDER_NODE, email: "someone-else@example.com" }] },
		});
		const order = await shopifyLookupOrder(CFG, {
			orderNumber: "1001",
			email: "ada@example.com",
		});
		expect(order).toBeNull();
	});

	it("returns null when no order matches", async () => {
		stubGraphql({ orders: { nodes: [] } });
		expect(
			await shopifyLookupOrder(CFG, {
				orderNumber: "9999",
				email: "ada@example.com",
			}),
		).toBeNull();
	});

	it("honors the apiBase override", async () => {
		const calls = stubGraphql({ orders: { nodes: [] } });
		await shopifyLookupOrder(
			{ ...CFG, apiBase: "http://127.0.0.1:9099" },
			{ orderNumber: "1001", email: "a@b.co" },
		);
		expect(calls[0]!.url).toBe(
			"http://127.0.0.1:9099/admin/api/2025-01/graphql.json",
		);
	});
});

describe("shopifyReturnableItems", () => {
	it("flattens returnable fulfillment line items", async () => {
		stubGraphql({
			returnableFulfillments: {
				edges: [
					{
						node: {
							returnableFulfillmentLineItems: {
								edges: [
									{
										node: {
											quantity: 2,
											fulfillmentLineItem: {
												id: "gid://shopify/FulfillmentLineItem/11",
												lineItem: { title: "Wrench" },
											},
										},
									},
								],
							},
						},
					},
				],
			},
		});
		expect(await shopifyReturnableItems(CFG, "gid://shopify/Order/1")).toEqual([
			{
				fulfillmentLineItemId: "gid://shopify/FulfillmentLineItem/11",
				title: "Wrench",
				quantity: 2,
			},
		]);
	});
});

describe("shopifyCreateReturn", () => {
	it("files the return and reports the created return", async () => {
		const calls = stubGraphql({
			returnCreate: {
				return: {
					id: "gid://shopify/Return/5",
					status: "OPEN",
					name: "#1001-R1",
				},
				userErrors: [],
			},
		});
		const created = await shopifyCreateReturn(CFG, {
			orderId: "gid://shopify/Order/1",
			items: [
				{
					fulfillmentLineItemId: "gid://shopify/FulfillmentLineItem/11",
					quantity: 1,
				},
			],
			reasonNote: "Too small",
		});
		expect(created).toEqual({
			id: "gid://shopify/Return/5",
			status: "OPEN",
			name: "#1001-R1",
		});
		const vars = calls[0]!.body.variables as {
			returnInput: {
				orderId: string;
				returnLineItems: { returnReasonNote?: string }[];
			};
		};
		expect(vars.returnInput.orderId).toBe("gid://shopify/Order/1");
		expect(vars.returnInput.returnLineItems[0]?.returnReasonNote).toBe(
			"Too small",
		);
	});

	it("surfaces userErrors as ShopifyError", async () => {
		stubGraphql({
			returnCreate: {
				return: null,
				userErrors: [{ field: null, message: "order is not eligible" }],
			},
		});
		await expect(
			shopifyCreateReturn(CFG, {
				orderId: "gid://shopify/Order/1",
				items: [{ fulfillmentLineItemId: "f1", quantity: 1 }],
			}),
		).rejects.toThrow("order is not eligible");
	});

	it("wraps network failures in a visitor-safe message", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("dial tcp: internal");
			}),
		);
		await expect(
			shopifyLookupOrder(CFG, { orderNumber: "1001", email: "a@b.co" }),
		).rejects.toBeInstanceOf(ShopifyError);
	});
});
