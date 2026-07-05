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

import { action } from "./webhooks.app.uninstalled";

const args = () =>
	({
		request: new Request("https://app.example.com/webhooks/app/uninstalled", {
			method: "POST",
			body: "{}",
		}),
		params: {},
		context: {},
	}) as never;

beforeEach(() => {
	webhookMock.mockReset();
	findSessionsByShopMock.mockReset();
	deleteSessionsMock.mockReset();
});

describe("app/uninstalled webhook (§7)", () => {
	it("deletes the shop's sessions when one still exists — and makes no Admin API calls", async () => {
		// authenticate.webhook returns NO admin client here: the token is already
		// invalid at delivery. The handler's whole job is local cleanup.
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			session: { id: "s1" },
			topic: "APP_UNINSTALLED",
		});
		findSessionsByShopMock.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(findSessionsByShopMock).toHaveBeenCalledExactlyOnceWith(
			"shop.myshopify.com",
		);
		expect(deleteSessionsMock).toHaveBeenCalledExactlyOnceWith(["s1", "s2"]);
	});

	it("is idempotent: a redelivery after sessions are gone still 200s", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			session: undefined,
			topic: "APP_UNINSTALLED",
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(findSessionsByShopMock).not.toHaveBeenCalled();
		expect(deleteSessionsMock).not.toHaveBeenCalled();
	});
});
