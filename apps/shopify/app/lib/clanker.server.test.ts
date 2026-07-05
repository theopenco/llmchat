import { describe, expect, it, vi } from "vitest";
import {
	clearProjectKey,
	getConnection,
	mapConfigStatus,
	maskKey,
	themeEditorDeepLink,
	validateProjectKey,
	writeProjectKey,
	METAFIELD_KEY,
	METAFIELD_NAMESPACE,
	METAFIELD_TYPE,
	type AdminGraphqlClient,
} from "./clanker.server";

function fakeAdmin(responses: unknown[]): {
	admin: AdminGraphqlClient;
	calls: { query: string; variables?: Record<string, unknown> }[];
} {
	const calls: { query: string; variables?: Record<string, unknown> }[] = [];
	const queue = [...responses];
	const admin: AdminGraphqlClient = {
		graphql: vi.fn(async (query, options) => {
			calls.push({ query, variables: options?.variables });
			const body = queue.shift();
			return { json: async () => body };
		}),
	};
	return { admin, calls };
}

describe("mapConfigStatus — the §5 three-way mapping", () => {
	it("maps 200 to valid", () => {
		expect(mapConfigStatus(200)).toBe("valid");
	});

	it("maps 404 to invalid — the only status that means a bad key", () => {
		expect(mapConfigStatus(404)).toBe("invalid");
	});

	it.each([500, 502, 503, 429, 301, 403])(
		"never maps %i to invalid — anything non-404 is unverified",
		(status) => {
			expect(mapConfigStatus(status)).toBe("unverified");
		},
	);
});

describe("validateProjectKey", () => {
	it("hits /v1/config/:key on the given origin with the key URI-encoded", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("{}", { status: 200 }),
		) as unknown as typeof fetch;
		const verdict = await validateProjectKey(
			"pk_ab/cd",
			fetchImpl,
			"https://api.example.com",
		);
		expect(verdict).toBe("valid");
		expect(fetchImpl).toHaveBeenCalledWith(
			"https://api.example.com/v1/config/pk_ab%2Fcd",
		);
	});

	it("returns invalid on 404", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("{}", { status: 404 }),
		) as unknown as typeof fetch;
		expect(await validateProjectKey("pk_x", fetchImpl)).toBe("invalid");
	});

	it("returns unverified on a network failure — never invalid", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new TypeError("fetch failed");
		}) as unknown as typeof fetch;
		expect(await validateProjectKey("pk_x", fetchImpl)).toBe("unverified");
	});

	it("returns unverified on 5xx", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("oops", { status: 503 }),
		) as unknown as typeof fetch;
		expect(await validateProjectKey("pk_x", fetchImpl)).toBe("unverified");
	});
});

describe("maskKey", () => {
	it("shows the pk_ prefix and last four characters only", () => {
		expect(maskKey("pk_be2dddeff3f7720be1709253f3fbe6bfbd6c0a2f82947e60")).toBe(
			"pk_…7e60",
		);
	});

	it("handles keys without the pk_ prefix", () => {
		expect(maskKey("legacy-key-abcd1234")).toBe("leg…1234");
	});

	it("never round-trips a short key", () => {
		expect(maskKey("pk_12345")).toBe("••••");
		expect(maskKey("")).toBe("••••");
	});
});

describe("themeEditorDeepLink", () => {
	it("builds the documented activateAppId URL shape", () => {
		expect(themeEditorDeepLink("shop.myshopify.com", "abc123")).toBe(
			"https://shop.myshopify.com/admin/themes/current/editor?context=apps&activateAppId=abc123/clanker-support",
		);
	});
});

describe("getConnection", () => {
	it("returns installation id and the stored key", async () => {
		const { admin } = fakeAdmin([
			{
				data: {
					currentAppInstallation: {
						id: "gid://shopify/AppInstallation/1",
						metafield: { value: "pk_stored" },
					},
				},
			},
		]);
		expect(await getConnection(admin)).toEqual({
			installationId: "gid://shopify/AppInstallation/1",
			projectKey: "pk_stored",
		});
	});

	it("treats a missing metafield as first-run (null key) — reinstall contract", async () => {
		const { admin } = fakeAdmin([
			{
				data: {
					currentAppInstallation: {
						id: "gid://shopify/AppInstallation/1",
						metafield: null,
					},
				},
			},
		]);
		expect((await getConnection(admin)).projectKey).toBeNull();
	});

	it("throws when the installation is missing entirely", async () => {
		const { admin } = fakeAdmin([{ data: {} }]);
		await expect(getConnection(admin)).rejects.toThrow(/no installation/);
	});
});

describe("writeProjectKey", () => {
	it("sends metafieldsSet with the exact §5 shape (plain namespace, required type)", async () => {
		const { admin, calls } = fakeAdmin([
			{ data: { metafieldsSet: { metafields: [{}], userErrors: [] } } },
		]);
		const result = await writeProjectKey(
			admin,
			"gid://shopify/AppInstallation/1",
			"pk_new",
		);
		expect(result).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		expect(calls[0]!.query).toContain("metafieldsSet");
		expect(calls[0]!.variables).toEqual({
			metafields: [
				{
					ownerId: "gid://shopify/AppInstallation/1",
					namespace: METAFIELD_NAMESPACE,
					key: METAFIELD_KEY,
					type: METAFIELD_TYPE,
					value: "pk_new",
				},
			],
		});
		// Guard against a well-meaning "$app:" refactor — plan §5 forbids it.
		expect(METAFIELD_NAMESPACE).toBe("clanker");
		expect(METAFIELD_TYPE).toBe("single_line_text_field");
	});

	it("surfaces userErrors as a failure", async () => {
		const { admin } = fakeAdmin([
			{
				data: {
					metafieldsSet: {
						metafields: [],
						userErrors: [{ field: ["value"], message: "Access denied" }],
					},
				},
			},
		]);
		const result = await writeProjectKey(admin, "gid://x", "pk_new");
		expect(result).toEqual({ ok: false, message: "Access denied" });
	});
});

describe("clearProjectKey", () => {
	it("sends metafieldsDelete with the owner identifier", async () => {
		const { admin, calls } = fakeAdmin([
			{
				data: {
					metafieldsDelete: { deletedMetafields: [{}], userErrors: [] },
				},
			},
		]);
		const result = await clearProjectKey(
			admin,
			"gid://shopify/AppInstallation/1",
		);
		expect(result).toEqual({ ok: true });
		expect(calls[0]!.query).toContain("metafieldsDelete");
		expect(calls[0]!.variables).toEqual({
			metafields: [
				{
					ownerId: "gid://shopify/AppInstallation/1",
					namespace: METAFIELD_NAMESPACE,
					key: METAFIELD_KEY,
				},
			],
		});
	});

	it("surfaces userErrors as a failure", async () => {
		const { admin } = fakeAdmin([
			{
				data: {
					metafieldsDelete: {
						deletedMetafields: [],
						userErrors: [{ message: "Not found" }],
					},
				},
			},
		]);
		expect(await clearProjectKey(admin, "gid://x")).toEqual({
			ok: false,
			message: "Not found",
		});
	});
});
