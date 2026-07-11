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
			onAction: (r) => actions.push(r),
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
		expect(actions).toHaveLength(1);
		expect(actions[0]).toMatchObject({
			kind: "calcom",
			tool: "get_available_slots",
			ok: true,
		});
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
			onAction: (r) => actions.push(r),
		});
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect(out).toEqual({ ok: false, error: "slot_taken" });
		expect(actions).toHaveLength(1);
		expect(actions[0]).toMatchObject({
			kind: "calcom",
			tool: "book_meeting",
			ok: false,
		});
	});
});

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

describe("shopify tools", () => {
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

	it("create_return without a returnVerification guard files directly (unguarded mode)", async () => {
		// Covered in depth by the suite below; this pins the unguarded default.
		expect(
			buildIntegrationTools({ rows: [SHOP_ROW], identity: IDENTITY })!.tools,
		).not.toHaveProperty("verify_return_code");
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

describe("return possession-proof (returnVerification guard, #131)", () => {
	/** Standard shopify upstream: order lookup + one returnable item + create. */
	const stubShopifyFetch = () => {
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
		return fetchSpy;
	};

	const rvMock = (over?: {
		check?: () => Promise<boolean>;
		start?: () => Promise<"sent" | "limited" | "unavailable">;
		confirm?: () => Promise<
			"verified" | "invalid" | "expired" | "locked" | "unavailable"
		>;
	}) => ({
		check: vi.fn(over?.check ?? (async () => false)),
		start: vi.fn(over?.start ?? (async () => "sent" as const)),
		confirm: vi.fn(over?.confirm ?? (async () => "verified" as const)),
	});

	it("exposes verify_return_code only when the guard is wired", () => {
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rvMock() },
		});
		expect(Object.keys(built!.tools)).toContain("verify_return_code");
		expect(built!.actionsBlock).toContain("verify_return_code");
	});

	it("unverified create_return sends a code and refuses — nothing is filed", async () => {
		const fetchSpy = stubShopifyFetch();
		const rv = rvMock();
		const actions: Record<string, unknown>[] = [];
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
			onAction: (r) => actions.push(r as unknown as Record<string, unknown>),
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain("verification_required");
		// Recipient is the order-verified address; key is the normalized order name.
		expect(rv.start).toHaveBeenCalledWith("1001", "ada@example.com");
		// Lookup + returnable ran; the ReturnCreate mutation never fired.
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(actions.at(-1)).toMatchObject({
			tool: "create_return",
			ok: false,
			detail: "verification code sent to the order email",
		});
	});

	it("verified create_return files as normal and never re-sends a code", async () => {
		const fetchSpy = stubShopifyFetch();
		const rv = rvMock({ check: async () => true });
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
		});
		const out = (await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		})) as { ok: boolean };
		expect(out.ok).toBe(true);
		expect(rv.check).toHaveBeenCalledWith("1001", "ada@example.com");
		expect(rv.start).not.toHaveBeenCalled();
		expect(fetchSpy).toHaveBeenCalledTimes(3);
	});

	it("send-limit and outages keep the gate shut with honest copy", async () => {
		stubShopifyFetch();
		for (const [outcome, needle] of [
			["limited", "Too many verification codes"],
			["unavailable", "temporarily unavailable"],
		] as const) {
			const built = buildIntegrationTools({
				rows: [SHOP_ROW],
				identity: IDENTITY,
				guards: {
					returnVerification: rvMock({ start: async () => outcome }),
				},
			});
			const out = await toolOf(built, "create_return").execute({
				orderNumber: "1001",
			});
			expect(out).toMatchObject({ ok: false });
			expect((out as { error: string }).error).toContain(needle);
		}
	});

	it("a throwing check fails closed (treated as unverified)", async () => {
		stubShopifyFetch();
		const rv = rvMock({
			check: async () => {
				throw new Error("state down");
			},
		});
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect(rv.start).toHaveBeenCalled();
	});

	it("a throwing start fails closed as unavailable (no return filed)", async () => {
		const fetchSpy = stubShopifyFetch();
		const rv = rvMock({
			start: async () => {
				throw new Error("state down");
			},
		});
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain(
			"temporarily unavailable",
		);
		expect(fetchSpy).toHaveBeenCalledTimes(2); // lookup + returnable, no ReturnCreate
	});

	it("keys the code on the visitor's order reference, not the canonical name (prefix stores)", async () => {
		// A store whose canonical order name carries a suffix the customer never types.
		const prefixed = {
			orders: {
				nodes: [{ ...ORDER.orders.nodes[0], name: "#1001-A" }],
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				const { query } = JSON.parse(init.body as string) as { query: string };
				if (query.includes("LookupOrder"))
					return Response.json({ data: prefixed });
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
											],
										},
									},
								},
							],
						},
					},
				});
			}),
		);
		const rv = rvMock();
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
		});
		await toolOf(built, "create_return").execute({ orderNumber: "1001" });
		// The key must be the visitor's "1001", NOT the canonical "1001-a" —
		// otherwise verify_return_code (which keys on visitor input) never matches.
		expect(rv.check).toHaveBeenCalledWith("1001", "ada@example.com");
		expect(rv.start).toHaveBeenCalledWith("1001", "ada@example.com");
	});

	it("verify_return_code is bounded by the fail-closed action limiter", async () => {
		const rv = rvMock();
		const actions: Record<string, unknown>[] = [];
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: {
				returnVerification: rv,
				actionLimit: async () => false, // over the quota
			},
			onAction: (r) => actions.push(r as unknown as Record<string, unknown>),
		});
		const out = await toolOf(built, "verify_return_code").execute({
			orderNumber: "1001",
			code: "123456",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain(
			"verification attempt limit",
		);
		// The guess never reached confirm — the limiter short-circuited it.
		expect(rv.confirm).not.toHaveBeenCalled();
		expect(actions.at(-1)).toMatchObject({
			tool: "verify_return_code",
			ok: false,
			detail: "blocked: verification attempt rate/quota limit",
		});
	});

	it("verify_return_code normalizes the order, audits without the code, and maps outcomes", async () => {
		const rv = rvMock();
		const actions: Record<string, unknown>[] = [];
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { returnVerification: rv },
			onAction: (r) => actions.push(r as unknown as Record<string, unknown>),
		});
		const verify = toolOf(built, "verify_return_code");

		const ok = await verify.execute({ orderNumber: "#1001", code: "123456" });
		expect(ok).toMatchObject({ ok: true, verified: true });
		expect(rv.confirm).toHaveBeenCalledWith("1001", "123456");
		expect(actions.at(-1)).toMatchObject({
			tool: "verify_return_code",
			ok: true,
		});
		// The code must never reach the audit log.
		expect(JSON.stringify(actions.at(-1)!.params)).not.toContain("123456");

		for (const [outcome, needle] of [
			["invalid", "doesn't match"],
			["expired", "expired"],
			["locked", "locked"],
			["unavailable", "temporarily unavailable"],
		] as const) {
			rv.confirm.mockResolvedValueOnce(outcome);
			const out = await verify.execute({
				orderNumber: "1001",
				code: "000000",
			});
			expect(out).toMatchObject({ ok: false });
			expect((out as { error: string }).error).toContain(needle);
		}

		rv.confirm.mockRejectedValueOnce(new Error("state down"));
		const down = await verify.execute({ orderNumber: "1001", code: "9" });
		expect(down).toMatchObject({ ok: false });
		expect((down as { error: string }).error).toContain(
			"temporarily unavailable",
		);
	});
});
