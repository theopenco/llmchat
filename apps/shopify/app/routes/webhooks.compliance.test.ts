import { beforeEach, describe, expect, it, vi } from "vitest";

const { webhookMock, findSessionsByShopMock, deleteSessionsMock } = vi.hoisted(
	() => ({
		webhookMock: vi.fn(),
		findSessionsByShopMock: vi.fn(),
		deleteSessionsMock: vi.fn(),
	}),
);

vi.mock("../shopify.server", () => ({
	getShopify: () => ({
		authenticate: { webhook: (request: Request) => webhookMock(request) },
		sessionStorage: {
			findSessionsByShop: findSessionsByShopMock,
			deleteSessions: deleteSessionsMock,
		},
	}),
}));

import { action } from "./webhooks.compliance";

function req(): Request {
	return new Request("https://app.example.com/webhooks/compliance", {
		method: "POST",
		body: "{}",
	});
}

const args = () => ({ request: req(), params: {}, context: {} }) as never;

beforeEach(() => {
	webhookMock.mockReset();
	findSessionsByShopMock.mockReset();
	deleteSessionsMock.mockReset();
});

describe("compliance webhook route (§7)", () => {
	it("customers/data_request: 200, touches nothing — we hold no customer data", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "CUSTOMERS_DATA_REQUEST",
			payload: { shop_domain: "shop.myshopify.com" },
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(findSessionsByShopMock).not.toHaveBeenCalled();
		expect(deleteSessionsMock).not.toHaveBeenCalled();
	});

	it("customers/redact: 200, touches nothing", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "CUSTOMERS_REDACT",
			payload: { shop_domain: "shop.myshopify.com" },
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteSessionsMock).not.toHaveBeenCalled();
	});

	it("shop/redact: deletes the shop's sessions keyed on payload.shop_domain", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SHOP_REDACT",
			payload: { shop_domain: "redacted-shop.myshopify.com" },
		});
		findSessionsByShopMock.mockResolvedValue([{ id: "a" }]);
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(findSessionsByShopMock).toHaveBeenCalledExactlyOnceWith(
			"redacted-shop.myshopify.com",
		);
		expect(deleteSessionsMock).toHaveBeenCalledExactlyOnceWith(["a"]);
	});

	it("shop/redact falls back to the authenticated shop when the payload lacks shop_domain", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SHOP_REDACT",
			payload: {},
		});
		findSessionsByShopMock.mockResolvedValue([{ id: "b" }]);
		await action(args());
		expect(findSessionsByShopMock).toHaveBeenCalledExactlyOnceWith(
			"shop.myshopify.com",
		);
		expect(deleteSessionsMock).toHaveBeenCalledExactlyOnceWith(["b"]);
	});

	it("invalid HMAC: authenticate.webhook's thrown 401 propagates untouched", async () => {
		webhookMock.mockRejectedValue(new Response(null, { status: 401 }));
		let thrown: unknown;
		try {
			await action(args());
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Response);
		expect((thrown as Response).status).toBe(401);
		expect(deleteSessionsMock).not.toHaveBeenCalled();
	});

	it("unknown topics still 200 (Shopify retries anything else)", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SOMETHING_NEW",
			payload: {},
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteSessionsMock).not.toHaveBeenCalled();
	});
});
