import { beforeEach, describe, expect, it, vi } from "vitest";

const { webhookMock, deleteManyMock } = vi.hoisted(() => ({
	webhookMock: vi.fn(),
	deleteManyMock: vi.fn(),
}));

vi.mock("../shopify.server", () => ({
	authenticate: { webhook: (request: Request) => webhookMock(request) },
}));
vi.mock("../db.server", () => ({
	default: { session: { deleteMany: deleteManyMock } },
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
	deleteManyMock.mockReset();
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
		expect(deleteManyMock).not.toHaveBeenCalled();
	});

	it("customers/redact: 200, touches nothing", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "CUSTOMERS_REDACT",
			payload: { shop_domain: "shop.myshopify.com" },
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteManyMock).not.toHaveBeenCalled();
	});

	it("shop/redact: deletes the shop's Session rows keyed on payload.shop_domain", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SHOP_REDACT",
			payload: { shop_domain: "redacted-shop.myshopify.com" },
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteManyMock).toHaveBeenCalledExactlyOnceWith({
			where: { shop: "redacted-shop.myshopify.com" },
		});
	});

	it("shop/redact falls back to the authenticated shop when the payload lacks shop_domain", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SHOP_REDACT",
			payload: {},
		});
		await action(args());
		expect(deleteManyMock).toHaveBeenCalledExactlyOnceWith({
			where: { shop: "shop.myshopify.com" },
		});
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
		expect(deleteManyMock).not.toHaveBeenCalled();
	});

	it("unknown topics still 200 (Shopify retries anything else)", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			topic: "SOMETHING_NEW",
			payload: {},
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteManyMock).not.toHaveBeenCalled();
	});
});
