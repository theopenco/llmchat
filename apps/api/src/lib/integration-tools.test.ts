import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIntegrationTools } from "./integration-tools";

const CAL_ROW = {
	kind: "calcom",
	config: JSON.stringify({
		apiKey: "cal_test_key",
		eventTypeId: 42,
		timeZone: "UTC",
	}),
};

const SHOP_ROW = {
	kind: "shopify",
	config: JSON.stringify({
		shopDomain: "acme.myshopify.com",
		accessToken: "shpat_x",
	}),
};

const IDENTITY = { name: "Ada", email: "ada@example.com" };

type ToolLike = {
	execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
const toolOf = (
	built: ReturnType<typeof buildIntegrationTools>,
	name: string,
) => (built!.tools as Record<string, unknown>)[name] as ToolLike;

afterEach(() => vi.unstubAllGlobals());

describe("buildIntegrationTools — assembly", () => {
	it("returns null with no rows (chat behavior stays untouched)", () => {
		expect(buildIntegrationTools({ rows: [], identity: {} })).toBeNull();
	});

	it("skips malformed JSON and invalid configs instead of throwing", () => {
		expect(
			buildIntegrationTools({
				rows: [
					{ kind: "calcom", config: "{not json" },
					{ kind: "shopify", config: JSON.stringify({ shopDomain: "nope" }) },
				],
				identity: {},
			}),
		).toBeNull();
	});

	it("exposes scheduling + order tools and an actions block with guardrails", () => {
		const built = buildIntegrationTools({
			rows: [CAL_ROW, SHOP_ROW],
			identity: IDENTITY,
		});
		expect(Object.keys(built!.tools).sort()).toEqual([
			"book_meeting",
			"create_return",
			"get_available_slots",
			"lookup_order",
		]);
		expect(built!.actionsBlock).toContain("# Actions");
		expect(built!.actionsBlock).toContain("never claim an action succeeded");
	});
});

describe("calcom tools", () => {
	it("get_available_slots returns slots and reports the action", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({
					status: "success",
					data: { "2026-07-07": [{ start: "2026-07-07T09:00:00.000Z" }] },
				}),
			),
		);
		const actions: unknown[] = [];
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
			onAction: (...a) => actions.push(a),
			now: new Date("2026-07-06T00:00:00Z"),
		});
		const out = await toolOf(built, "get_available_slots").execute({
			days: 3,
		});
		expect(out).toEqual({
			ok: true,
			timeZone: "UTC",
			slots: ["2026-07-07T09:00:00.000Z"],
		});
		expect(actions).toEqual([["calcom", "get_available_slots", true]]);
	});

	it("book_meeting falls back to the conversation identity for name/email", async () => {
		const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) =>
			Response.json({
				status: "success",
				data: { uid: "bk1", status: "accepted", start: "s" },
			}),
		);
		vi.stubGlobal("fetch", fetchSpy);
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
		});
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect((out as { ok: boolean }).ok).toBe(true);
		const body = JSON.parse(
			(fetchSpy.mock.calls[0]![1] as RequestInit).body as string,
		);
		expect(body.attendee.email).toBe("ada@example.com");
		expect(body.attendee.name).toBe("Ada");
	});

	it("book_meeting refuses without any email and tells the model to ask", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const built = buildIntegrationTools({ rows: [CAL_ROW], identity: {} });
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain("email");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("upstream failures come back as ok:false data, never a throw", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json(
					{ status: "error", error: { message: "slot_taken" } },
					{ status: 400 },
				),
			),
		);
		const actions: unknown[] = [];
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
			onAction: (...a) => actions.push(a),
		});
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect(out).toEqual({ ok: false, error: "slot_taken" });
		expect(actions).toEqual([["calcom", "book_meeting", false]]);
	});
});

describe("shopify tools", () => {
	const ORDER = {
		orders: {
			nodes: [
				{
					id: "gid://shopify/Order/1",
					name: "#1001",
					email: "ada@example.com",
					createdAt: "2026-06-20T00:00:00Z",
					displayFinancialStatus: "PAID",
					displayFulfillmentStatus: "FULFILLED",
					totalPriceSet: {
						shopMoney: { amount: "49.00", currencyCode: "USD" },
					},
					lineItems: { nodes: [{ title: "Wrench", quantity: 1 }] },
					fulfillments: [],
				},
			],
		},
	};

	it("lookup_order uses the identity email and strips the internal gid", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ data: ORDER })),
		);
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
		});
		const out = (await toolOf(built, "lookup_order").execute({
			orderNumber: "1001",
		})) as { ok: boolean; order: Record<string, unknown> };
		expect(out.ok).toBe(true);
		expect(out.order.name).toBe("#1001");
		expect(out.order).not.toHaveProperty("id");
	});

	it("lookup_order without any email refuses and asks", async () => {
		vi.stubGlobal("fetch", vi.fn());
		const built = buildIntegrationTools({ rows: [SHOP_ROW], identity: {} });
		const out = await toolOf(built, "lookup_order").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
	});

	it("create_return filters returnable items by title and files the return", async () => {
		const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
			const { query } = JSON.parse(init.body as string) as { query: string };
			if (query.includes("LookupOrder")) return Response.json({ data: ORDER });
			if (query.includes("ReturnableItems")) {
				return Response.json({
					data: {
						returnableFulfillments: {
							edges: [
								{
									node: {
										returnableFulfillmentLineItems: {
											edges: [
												{
													node: {
														quantity: 1,
														fulfillmentLineItem: {
															id: "fli1",
															lineItem: { title: "Wrench" },
														},
													},
												},
												{
													node: {
														quantity: 1,
														fulfillmentLineItem: {
															id: "fli2",
															lineItem: { title: "Hammer" },
														},
													},
												},
											],
										},
									},
								},
							],
						},
					},
				});
			}
			return Response.json({
				data: {
					returnCreate: {
						return: { id: "r1", status: "OPEN", name: "#1001-R1" },
						userErrors: [],
					},
				},
			});
		});
		vi.stubGlobal("fetch", fetchSpy);
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
		});
		const out = (await toolOf(built, "create_return").execute({
			orderNumber: "1001",
			itemTitles: ["wrench"],
			reason: "wrong size",
		})) as { ok: boolean; return: { items: { title: string }[] } };
		expect(out.ok).toBe(true);
		expect(out.return.items).toEqual([{ title: "Wrench", quantity: 1 }]);
		// The returnCreate call must only include the matched item.
		const returnCall = JSON.parse(
			(fetchSpy.mock.calls[2]![1] as RequestInit).body as string,
		) as { variables: { returnInput: { returnLineItems: unknown[] } } };
		expect(returnCall.variables.returnInput.returnLineItems).toHaveLength(1);
	});

	it("create_return reports 'nothing returnable' instead of filing empty returns", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				const { query } = JSON.parse(init.body as string) as { query: string };
				if (query.includes("LookupOrder"))
					return Response.json({ data: ORDER });
				return Response.json({
					data: { returnableFulfillments: { edges: [] } },
				});
			}),
		);
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain("returnable");
	});
});
