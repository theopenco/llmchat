import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminMock = vi.fn();

vi.mock("../shopify.server", () => ({
	getShopify: () => ({
		authenticate: { admin: (request: Request) => adminMock(request) },
	}),
	// Empty env → the action falls back to the hosted default origin.
	getShopifyEnv: () => ({}),
}));

import { action } from "./app._index";

const CONNECTION_RESPONSE = {
	data: {
		currentAppInstallation: {
			id: "gid://shopify/AppInstallation/1",
			metafield: null,
		},
	},
};
const SET_OK = {
	data: { metafieldsSet: { metafields: [{}], userErrors: [] } },
};
const DELETE_OK = {
	data: { metafieldsDelete: { deletedMetafields: [{}], userErrors: [] } },
};

function fakeAdmin(
	responses: unknown[],
	session: Record<string, unknown> = { shop: "shop.myshopify.com" },
) {
	const calls: { query: string; variables?: Record<string, unknown> }[] = [];
	const queue = [...responses];
	adminMock.mockResolvedValue({
		admin: {
			graphql: async (
				query: string,
				options?: { variables?: Record<string, unknown> },
			) => {
				calls.push({ query, variables: options?.variables });
				return { json: async () => queue.shift() };
			},
		},
		session,
	});
	return calls;
}

function submit(fields: Record<string, string>) {
	const body = new URLSearchParams(fields);
	return action({
		request: new Request("https://app.example.com/app", {
			method: "POST",
			body,
			headers: { "content-type": "application/x-www-form-urlencoded" },
		}),
		params: {},
		context: {},
	} as never);
}

const fetchMock = vi.fn();

beforeEach(() => {
	adminMock.mockReset();
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("connect action — §5 validation flow", () => {
	it("rejects an empty key without calling anything", async () => {
		fakeAdmin([]);
		const result = await submit({ intent: "connect", projectKey: "   " });
		expect(result.status).toBe("error");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("404 → invalid, and the metafield is NOT written", async () => {
		const calls = fakeAdmin([]);
		fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
		const result = await submit({ intent: "connect", projectKey: "pk_bad" });
		expect(result).toEqual({ status: "invalid" });
		expect(calls).toHaveLength(0);
	});

	it("200 → valid → metafieldsSet with the trimmed key", async () => {
		const calls = fakeAdmin([CONNECTION_RESPONSE, SET_OK]);
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const result = await submit({
			intent: "connect",
			projectKey: "  pk_good  ",
		});
		expect(result).toEqual({ status: "connected" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.clankersupport.com/v1/config/pk_good",
		);
		expect(calls).toHaveLength(2);
		expect(calls[1]!.variables).toMatchObject({
			metafields: [
				{
					ownerId: "gid://shopify/AppInstallation/1",
					namespace: "clanker",
					key: "project_key",
					type: "single_line_text_field",
					value: "pk_good",
				},
			],
		});
	});

	it("5xx → unverified (offer save-anyway), and the metafield is NOT written", async () => {
		const calls = fakeAdmin([]);
		fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
		const result = await submit({ intent: "connect", projectKey: "pk_maybe" });
		expect(result).toEqual({ status: "unverified", key: "pk_maybe" });
		expect(calls).toHaveLength(0);
	});

	it("network failure → unverified, never invalid", async () => {
		fakeAdmin([]);
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		const result = await submit({ intent: "connect", projectKey: "pk_maybe" });
		expect(result).toEqual({ status: "unverified", key: "pk_maybe" });
	});

	it("saveAnyway=true writes without validating", async () => {
		const calls = fakeAdmin([CONNECTION_RESPONSE, SET_OK]);
		const result = await submit({
			intent: "connect",
			projectKey: "pk_maybe",
			saveAnyway: "true",
		});
		expect(result).toEqual({ status: "connected" });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(calls).toHaveLength(2);
	});

	it("metafieldsSet userErrors surface as an error result", async () => {
		fakeAdmin([
			CONNECTION_RESPONSE,
			{
				data: {
					metafieldsSet: {
						metafields: [],
						userErrors: [{ message: "Access denied" }],
					},
				},
			},
		]);
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const result = await submit({ intent: "connect", projectKey: "pk_good" });
		expect(result).toEqual({ status: "error", message: "Access denied" });
	});
});

describe("disconnect action", () => {
	it("deletes the metafield by owner identifier", async () => {
		const calls = fakeAdmin([CONNECTION_RESPONSE, DELETE_OK]);
		const result = await submit({ intent: "disconnect" });
		expect(result).toEqual({ status: "disconnected" });
		expect(calls).toHaveLength(2);
		expect(calls[1]!.query).toContain("metafieldsDelete");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("link-actions action — order-actions pairing", () => {
	const SESSION = {
		shop: "shop.myshopify.com",
		accessToken: "shpat_offline_token",
	};

	it("rejects an empty code without calling Clanker", async () => {
		fakeAdmin([], SESSION);
		const result = await submit({ intent: "link-actions", pairCode: "  " });
		expect(result).toMatchObject({ status: "error", from: "link-actions" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("errors when the session has no offline token", async () => {
		fakeAdmin([], { shop: "shop.myshopify.com" });
		const result = await submit({
			intent: "link-actions",
			pairCode: "code1234",
		});
		expect(result).toMatchObject({ status: "error", from: "link-actions" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("pushes shop domain + offline token to the register endpoint", async () => {
		fakeAdmin([], SESSION);
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), { status: 200 }),
		);
		const result = await submit({
			intent: "link-actions",
			pairCode: " code1234 ",
		});
		expect(result).toEqual({ status: "actions-linked" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.clankersupport.com/v1/integrations/shopify/register",
			expect.objectContaining({ method: "POST" }),
		);
		const body = JSON.parse(
			(fetchMock.mock.calls[0]![1] as RequestInit).body as string,
		);
		expect(body).toEqual({
			code: "code1234",
			shopDomain: "shop.myshopify.com",
			accessToken: "shpat_offline_token",
		});
	});

	it("maps a 404 to the expired-code message", async () => {
		fakeAdmin([], SESSION);
		fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
		const result = await submit({
			intent: "link-actions",
			pairCode: "code1234",
		});
		expect(result).toMatchObject({ status: "error", from: "link-actions" });
		expect((result as { message: string }).message).toMatch(/expired/i);
	});
});
