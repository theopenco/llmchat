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
	deleteManyMock.mockReset();
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
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteManyMock).toHaveBeenCalledExactlyOnceWith({
			where: { shop: "shop.myshopify.com" },
		});
	});

	it("is idempotent: a redelivery after sessions are gone still 200s", async () => {
		webhookMock.mockResolvedValue({
			shop: "shop.myshopify.com",
			session: undefined,
			topic: "APP_UNINSTALLED",
		});
		const res = await action(args());
		expect(res.status).toBe(200);
		expect(deleteManyMock).not.toHaveBeenCalled();
	});
});
