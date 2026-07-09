// ADVERSARIAL re-test of the PR #128 merge-blocking hardening. Each block first
// runs the ATTACK against the hardened tool code and asserts it is now blocked,
// then confirms the legit happy path still works and the audit trail captured
// the action. Complements the per-client tests in shopify-admin/calcom .test.ts.
//
//   C1 SSRF          — a config-supplied apiBase can no longer redirect the
//                      access token; only a trusted param/env override can.
//   C2 audit         — every tool call surfaces an onAction record (params carry
//                      order/email, NEVER credentials).
//   C3 Cal.com bind  — book_meeting attendee is the on-file identity email, never
//                      a model-chosen ("book for victim@x.com") address.
//   C4 rate + once   — a blocking actionLimit refuses before any upstream call;
//                      create_return is idempotent (no double-file).

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildIntegrationTools } from "./integration-tools";

const IDENTITY = { name: "Ada", email: "ada@example.com" };

const CAL_ROW = {
	kind: "calcom",
	config: JSON.stringify({
		apiKey: "cal_secret",
		eventTypeId: 42,
		timeZone: "UTC",
	}),
};
const SHOP_ROW = {
	kind: "shopify",
	config: JSON.stringify({
		shopDomain: "acme.myshopify.com",
		accessToken: "shpat_secret",
	}),
};

type ToolLike = {
	execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
const toolOf = (
	built: ReturnType<typeof buildIntegrationTools>,
	name: string,
) => (built!.tools as Record<string, unknown>)[name] as ToolLike;

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
				totalPriceSet: { shopMoney: { amount: "49.00", currencyCode: "USD" } },
				lineItems: { nodes: [{ title: "Wrench", quantity: 1 }] },
				fulfillments: [],
			},
		],
	},
};

/** Records every fetch, routing Shopify GraphQL by operation name. */
function stubFetch() {
	const calls: { url: string; body: string }[] = [];
	const fn = vi.fn(async (url: string, init: RequestInit) => {
		const body = (init?.body as string) ?? "";
		calls.push({ url, body });
		// Cal.com booking
		if (url.includes("/v2/bookings")) {
			return Response.json({
				status: "success",
				data: {
					uid: "bk1",
					status: "accepted",
					start: "2026-07-07T09:00:00.000Z",
				},
			});
		}
		// Shopify GraphQL — pick response by operation
		if (body.includes("LookupOrder")) return Response.json({ data: ORDER });
		if (body.includes("ReturnableItems")) {
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
		if (body.includes("CreateReturn")) {
			return Response.json({
				data: {
					returnCreate: {
						return: { id: "r1", status: "OPEN", name: "#1001-R1" },
						userErrors: [],
					},
				},
			});
		}
		return Response.json({ data: {} });
	});
	vi.stubGlobal("fetch", fn);
	return { calls, fn };
}

afterEach(() => vi.unstubAllGlobals());

// ── C3: Cal.com attendee binding ────────────────────────────────────────────
describe("C3 — book_meeting attendee is bound to the on-file identity", () => {
	it("ATTACK: a model-supplied 'victim@x.com' email is ignored; the invite goes to the on-file address", async () => {
		const { calls } = stubFetch();
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
		});
		// The tool schema no longer exposes an `email` param; even if the model
		// smuggles one, execute ignores it and uses identity.email.
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
			email: "victim@x.com",
		});
		expect((out as { ok: boolean }).ok).toBe(true);
		const booking = calls.find((c) => c.url.includes("/v2/bookings"))!;
		const attendee = JSON.parse(booking.body).attendee;
		expect(attendee.email).toBe("ada@example.com");
		expect(attendee.email).not.toBe("victim@x.com");
	});

	it("the book_meeting tool schema exposes NO attendee-email field to the model", () => {
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
		});
		const schema = (
			built!.tools.book_meeting as unknown as {
				inputSchema: { shape?: Record<string, unknown> };
			}
		).inputSchema;
		// zod object exposes `.shape`; email must be absent.
		const keys = Object.keys(schema.shape ?? {});
		expect(keys).not.toContain("email");
		expect(keys).toContain("start");
	});

	it("HAPPY PATH: an anonymous conversation cannot book (no email on file) and never calls Cal.com", async () => {
		const { fn } = stubFetch();
		const built = buildIntegrationTools({ rows: [CAL_ROW], identity: {} });
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toContain("email");
		expect(fn).not.toHaveBeenCalled();
	});
});

// ── C1: SSRF via config apiBase ─────────────────────────────────────────────
describe("C1 — a config-supplied apiBase can no longer redirect the token (SSRF)", () => {
	it("ATTACK: a shopify row whose config carries apiBase=evil is stripped; the token only reaches the shop domain", async () => {
		const { calls } = stubFetch();
		const evilRow = {
			kind: "shopify",
			config: JSON.stringify({
				shopDomain: "acme.myshopify.com",
				accessToken: "shpat_secret",
				apiBase: "http://evil.example", // admin-smuggled — must be ignored
			}),
		};
		const built = buildIntegrationTools({
			rows: [evilRow],
			identity: IDENTITY,
		});
		await toolOf(built, "lookup_order").execute({ orderNumber: "1001" });
		expect(calls).toHaveLength(1);
		expect(calls[0]!.url.startsWith("https://acme.myshopify.com/")).toBe(true);
		expect(calls[0]!.url).not.toContain("evil.example");
	});

	it("HAPPY PATH: a TRUSTED baseOverride (env/self-host) still redirects the client", async () => {
		const { calls } = stubFetch();
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			baseOverrides: { shopify: "http://127.0.0.1:9099" },
		});
		await toolOf(built, "lookup_order").execute({ orderNumber: "1001" });
		expect(calls[0]!.url.startsWith("http://127.0.0.1:9099/")).toBe(true);
	});
});

// ── C4: action rate/quota gate ──────────────────────────────────────────────
describe("C4 — a blocking actionLimit refuses before any upstream call", () => {
	it("ATTACK: spammed book_meeting is refused with no Cal.com call once the limit trips", async () => {
		const { fn } = stubFetch();
		const actions: { tool: string; ok: boolean; detail?: string }[] = [];
		const built = buildIntegrationTools({
			rows: [CAL_ROW],
			identity: IDENTITY,
			guards: { actionLimit: async () => false },
			onAction: (r) => actions.push(r),
		});
		const out = await toolOf(built, "book_meeting").execute({
			start: "2026-07-07T09:00:00.000Z",
		});
		expect(out).toMatchObject({ ok: false });
		expect((out as { error: string }).error).toMatch(/limit|later|human/i);
		expect(fn).not.toHaveBeenCalled();
		expect(actions.at(-1)).toMatchObject({ tool: "book_meeting", ok: false });
		expect(actions.at(-1)!.detail).toContain("blocked");
	});

	it("ATTACK: spammed create_return is refused before any Shopify mutation", async () => {
		const { fn } = stubFetch();
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			guards: { actionLimit: async () => false },
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect(fn).not.toHaveBeenCalled();
	});
});

// ── C4: create_return idempotency ───────────────────────────────────────────
describe("C4 — create_return is idempotent (no double-file)", () => {
	it("ATTACK: two identical return requests file the return exactly once", async () => {
		const { calls } = stubFetch();
		const seen = new Set<string>();
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			conversationId: "conv1",
			guards: {
				once: async (key) => {
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				},
			},
		});
		const first = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		const second = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
		});
		expect((first as { ok: boolean }).ok).toBe(true);
		expect(second).toMatchObject({ ok: false });
		expect((second as { error: string }).error).toMatch(
			/just filed|won't file/i,
		);
		// Exactly ONE returnCreate mutation across both attempts.
		const mutations = calls.filter((c) => c.body.includes("CreateReturn"));
		expect(mutations).toHaveLength(1);
	});
});

// ── C2: audit trail ─────────────────────────────────────────────────────────
describe("C2 — every action surfaces an audit record, never a credential", () => {
	it("HAPPY PATH: a filed return emits ok:true with a human detail and NO secret in params", async () => {
		stubFetch();
		const actions: {
			kind: string;
			tool: string;
			ok: boolean;
			detail?: string;
			params?: Record<string, unknown>;
		}[] = [];
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: IDENTITY,
			onAction: (r) => actions.push(r),
		});
		const out = await toolOf(built, "create_return").execute({
			orderNumber: "1001",
			itemTitles: ["wrench"],
			reason: "too small",
		});
		expect((out as { ok: boolean }).ok).toBe(true);
		const rec = actions.find((a) => a.tool === "create_return" && a.ok);
		expect(rec).toBeTruthy();
		expect(rec!.kind).toBe("shopify");
		expect(rec!.detail).toMatch(/return/i);
		// Params carry the visitor-supplied order/email but NEVER the token.
		const serialized = JSON.stringify(rec!.params ?? {});
		expect(serialized).toContain("1001");
		expect(serialized).not.toContain("shpat_secret");
		expect(serialized).not.toContain("accessToken");
	});

	it("cross-tenant guard intact: a mismatched order email yields no order + an ok:false audit record", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				// order belongs to someone else — the server re-check returns null
				Response.json({
					data: {
						orders: {
							nodes: [
								{ ...ORDER.orders.nodes[0], email: "someone-else@x.com" },
							],
						},
					},
				}),
			),
		);
		const actions: { tool: string; ok: boolean }[] = [];
		const built = buildIntegrationTools({
			rows: [SHOP_ROW],
			identity: { email: "attacker@evil.com" },
			onAction: (r) => actions.push(r),
		});
		const out = await toolOf(built, "lookup_order").execute({
			orderNumber: "1001",
		});
		expect(out).toMatchObject({ ok: false });
		expect(actions.at(-1)).toMatchObject({ tool: "lookup_order", ok: false });
	});
});
