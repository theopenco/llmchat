import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import {
	notifySubscriptionCancelled,
	notifySubscriptionStarted,
} from "@/lib/discord";
import {
	createCheckoutSession,
	createCustomer,
	createPortalSession,
	hmacSha256Hex,
} from "@/lib/stripe";

import { billing } from "./billing";

// Auth: a header-driven fake session so requireSession/requireOwner run for real
// without standing up Better Auth. `x-test-user` present ⇒ signed in.
vi.mock("@/auth", () => ({
	createAuth: () => ({
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-test-user");
				return id ? { user: { id } } : null;
			},
		},
	}),
}));

vi.mock("@/lib/db", () => ({ db: vi.fn() }));

// The webhook's Discord pings; stubbed so the wiring (which events fire which
// notification, with what details) is assertable without network. The embed
// payloads themselves are unit-tested in lib/discord.test.ts.
vi.mock("@/lib/discord", () => ({
	notifySubscriptionStarted: vi.fn(async () => {}),
	notifySubscriptionCancelled: vi.fn(async () => {}),
}));

// Mock only the Stripe HTTP calls; keep signature verification + hashing real.
vi.mock("@/lib/stripe", async (orig) => ({
	...(await orig<typeof import("@/lib/stripe")>()),
	createCustomer: vi.fn(),
	createCheckoutSession: vi.fn(),
	createPortalSession: vi.fn(),
}));

const WEBHOOK_SECRET = "whsec_fixture";

const ENV = {
	vars: {
		STRIPE_SECRET_KEY: "sk_test_fixture",
		STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
		STRIPE_PRICE_STARTER: "price_starter",
		STRIPE_PRICE_GROWTH: "price_growth",
		STRIPE_PRICE_SCALE: "price_scale",
		STRIPE_PRICE_GROWTH_OVERAGE: "price_growth_overage",
		STRIPE_PRICE_SCALE_OVERAGE: "price_scale_overage",
		DASHBOARD_URL: "https://dash.example.com",
	},
	DB: {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

interface State {
	member?: { role: string };
	workspace: Record<string, unknown>;
	user?: { email: string };
}

function mockDb(state: State) {
	const fake = {
		query: {
			member: { findFirst: async () => state.member },
			workspace: { findFirst: async () => state.workspace },
			user: { findFirst: async () => state.user },
		},
		update: () => ({
			set: (vals: Record<string, unknown>) => ({
				where: async () => {
					Object.assign(state.workspace, vals);
					return [];
				},
			}),
		}),
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

function req(path: string, init: RequestInit = {}) {
	return billing.request(path, init, ENV);
}

const ownerHeaders = {
	"x-test-user": "u1",
	"x-workspace-id": "ws_1",
	"content-type": "application/json",
};
const checkout = (plan: string, returnTo?: string, env = ENV) =>
	billing.request(
		"/billing/checkout",
		{
			method: "POST",
			headers: ownerHeaders,
			body: JSON.stringify({ plan, ...(returnTo ? { returnTo } : {}) }),
		},
		env,
	);

async function signed(
	body: string,
	opts: { tSec?: number; secret?: string } = {},
) {
	const t = opts.tSec ?? Math.floor(Date.now() / 1000);
	const v1 = await hmacSha256Hex(opts.secret ?? WEBHOOK_SECRET, `${t}.${body}`);
	return `t=${t},v1=${v1}`;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /billing/checkout", () => {
	it("403s a non-owner before any validation or Stripe call", async () => {
		mockDb({ workspace: { id: "ws_1" } }); // no member row ⇒ not owner
		const res = await checkout("starter");
		expect(res.status).toBe(403);
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it("400s an unknown plan (zod enum)", async () => {
		mockDb({ member: { role: "owner" }, workspace: { id: "ws_1" } });
		const res = await checkout("enterprise");
		expect(res.status).toBe(400);
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it("Starter checkout uses the base price and NO overage price", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_1" },
		});
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs",
			url: "https://checkout/cs",
		});
		const res = await checkout("starter");
		expect(res.status).toBe(200);
		expect(createCheckoutSession).toHaveBeenCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				customer: "cus_1",
				priceId: "price_starter",
				overagePriceId: undefined,
				plan: "starter",
				successUrl: "https://dash.example.com/settings/billing?status=success",
			}),
		);
	});

	it("Growth checkout includes the metered overage price", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_1" },
		});
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs",
			url: "https://checkout/cs",
		});
		await checkout("growth");
		expect(createCheckoutSession).toHaveBeenCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				priceId: "price_growth",
				overagePriceId: "price_growth_overage",
				plan: "growth",
			}),
		);
	});

	it("still sells an overage tier when its overage price is unset — just omits the line item", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_1" },
		});
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs",
			url: "https://checkout/cs",
		});
		const env = {
			...ENV,
			vars: { ...ENV.vars, STRIPE_PRICE_GROWTH_OVERAGE: "" },
		};
		const res = await checkout("growth", undefined, env);
		expect(res.status).toBe(200); // base price is enough to sell the tier
		expect(createCheckoutSession).toHaveBeenCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				priceId: "price_growth",
				overagePriceId: undefined,
			}),
		);
	});

	it("503s when STRIPE_SECRET_KEY is unset", async () => {
		mockDb({ member: { role: "owner" }, workspace: { id: "ws_1" } });
		const env = { ...ENV, vars: { ...ENV.vars, STRIPE_SECRET_KEY: "" } };
		const res = await checkout("starter", undefined, env);
		expect(res.status).toBe(503);
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it("honors a safe in-app returnTo and rejects an off-site one", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_1" },
		});
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs",
			url: "https://checkout/cs",
		});

		await checkout("starter", "/onboarding");
		expect(createCheckoutSession).toHaveBeenLastCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				successUrl: "https://dash.example.com/onboarding?status=success",
				cancelUrl: "https://dash.example.com/onboarding?status=cancel",
			}),
		);

		// A protocol-relative / absolute URL must NOT redirect off-domain.
		await checkout("starter", "https://evil.com/phish");
		expect(createCheckoutSession).toHaveBeenLastCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				successUrl: "https://dash.example.com/settings/billing?status=success",
			}),
		);
	});

	it("creates and stores a customer when the workspace has none", async () => {
		const state = mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: null },
			user: { email: "owner@example.com" },
		});
		vi.mocked(createCustomer).mockResolvedValue({ id: "cus_new" });
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs",
			url: "https://checkout/cs",
		});
		const res = await checkout("starter");
		expect(res.status).toBe(200);
		expect(state.workspace.stripeCustomerId).toBe("cus_new");
	});
});

describe("POST /billing/portal", () => {
	const headers = { "x-test-user": "u1", "x-workspace-id": "ws_1" };

	it("403s a non-owner", async () => {
		mockDb({ workspace: { id: "ws_1", stripeCustomerId: "cus_1" } });
		const res = await req("/billing/portal", { method: "POST", headers });
		expect(res.status).toBe(403);
		expect(createPortalSession).not.toHaveBeenCalled();
	});

	it("400s when the workspace has no Stripe customer", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: null },
		});
		const res = await req("/billing/portal", { method: "POST", headers });
		expect(res.status).toBe(400);
	});

	it("returns a portal url for an owner with a customer", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_1" },
		});
		vi.mocked(createPortalSession).mockResolvedValue({
			id: "bps_1",
			url: "https://billing.stripe.com/p/1",
		});
		const res = await req("/billing/portal", { method: "POST", headers });
		expect(res.status).toBe(200);
		expect(createPortalSession).toHaveBeenCalledWith("sk_test_fixture", {
			customer: "cus_1",
			returnUrl: "https://dash.example.com/settings/billing",
		});
	});
});

describe("POST /billing/webhook", () => {
	const completed = (plan?: string) =>
		JSON.stringify({
			id: "evt_1",
			type: "checkout.session.completed",
			data: {
				object: {
					client_reference_id: "ws_1",
					customer: "cus_1",
					subscription: "sub_1",
					...(plan ? { metadata: { workspaceId: "ws_1", plan } } : {}),
				},
			},
		});

	async function post(body: string, sig: string | null) {
		return req("/billing/webhook", {
			method: "POST",
			headers: sig ? { "stripe-signature": sig } : {},
			body,
		});
	}

	it("promotes to the purchased tier from session metadata", async () => {
		const state = mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const body = completed("growth");
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("growth");
		expect(state.workspace.stripeCustomerId).toBe("cus_1");
		expect(state.workspace.stripeSubscriptionId).toBe("sub_1");
	});

	it("falls back to 'none' if the completed session carries no plan stamp", async () => {
		const state = mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const body = completed(); // no metadata.plan
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("none");
	});

	it("rejects an unknown plan stamp to 'none' (never trusts a bad value)", async () => {
		const state = mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const body = completed("enterprise");
		await post(body, await signed(body));
		expect(state.workspace.plan).toBe("none");
	});

	it("subscription.updated active → stamped tier; canceled → none", async () => {
		const updated = (status: string) =>
			JSON.stringify({
				id: "evt_2",
				type: "customer.subscription.updated",
				data: {
					object: {
						id: "sub_1",
						customer: "cus_1",
						status,
						metadata: { workspaceId: "ws_1", plan: "scale" },
					},
				},
			});

		const active = mockDb({ workspace: { id: "ws_1", plan: "none" } });
		await post(updated("active"), await signed(updated("active")));
		expect(active.workspace.plan).toBe("scale");

		const canceled = mockDb({ workspace: { id: "ws_1", plan: "scale" } });
		await post(updated("canceled"), await signed(updated("canceled")));
		expect(canceled.workspace.plan).toBe("none");
	});

	it("subscription.deleted → none and clears the subscription id", async () => {
		const body = JSON.stringify({
			id: "evt_3",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_1", customer: "cus_1" } },
		});
		const state = mockDb({
			workspace: { id: "ws_1", plan: "scale", stripeSubscriptionId: "sub_1" },
		});
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("none");
		expect(state.workspace.stripeSubscriptionId).toBeNull();
	});

	it("acks an unhandled event type without changing plan", async () => {
		const body = JSON.stringify({
			id: "evt_x",
			type: "invoice.paid",
			data: { object: {} },
		});
		const state = mockDb({ workspace: { id: "ws_1", plan: "growth" } });
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("growth");
	});

	// Discord notification wiring: notifications run detached (waitUntil), so
	// these tests pass an ExecutionContext and settle it before asserting.
	function makeCtx() {
		const pending: Promise<unknown>[] = [];
		return {
			ctx: {
				waitUntil: (p: Promise<unknown>) => pending.push(Promise.resolve(p)),
				passThroughOnException: () => {},
				props: {},
			} as unknown as Parameters<typeof billing.request>[3],
			settle: () => Promise.allSettled(pending),
		};
	}

	function postWithCtx(
		body: string,
		sig: string,
		ctx: Parameters<typeof billing.request>[3],
	) {
		return billing.request(
			"/billing/webhook",
			{ method: "POST", headers: { "stripe-signature": sig }, body },
			ENV,
			ctx,
		);
	}

	it("pings Discord with owner + workspace details when checkout completes on a paid tier", async () => {
		mockDb({
			workspace: { id: "ws_1", name: "Acme", ownerId: "u1", plan: "none" },
			user: { email: "owner@example.com" },
		});
		const { ctx, settle } = makeCtx();
		const body = completed("growth");
		const res = await postWithCtx(body, await signed(body), ctx);
		expect(res.status).toBe(200);
		await settle();
		expect(notifySubscriptionStarted).toHaveBeenCalledWith(expect.anything(), {
			email: "owner@example.com",
			workspaceName: "Acme",
			plan: "growth",
		});
	});

	it("does not ping Discord when the completed session resolves to no plan", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const { ctx, settle } = makeCtx();
		const body = completed(); // no plan stamp → "none"
		await postWithCtx(body, await signed(body), ctx);
		await settle();
		expect(notifySubscriptionStarted).not.toHaveBeenCalled();
	});

	it("pings Discord with the LOST tier when a paid subscription is deleted", async () => {
		mockDb({
			workspace: {
				id: "ws_1",
				name: "Acme",
				ownerId: "u1",
				plan: "scale",
				stripeSubscriptionId: "sub_1",
			},
			user: { email: "owner@example.com" },
		});
		const { ctx, settle } = makeCtx();
		const body = JSON.stringify({
			id: "evt_3",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_1", customer: "cus_1" } },
		});
		await postWithCtx(body, await signed(body), ctx);
		await settle();
		// The plan reported is the tier they had BEFORE the downgrade to none.
		expect(notifySubscriptionCancelled).toHaveBeenCalledWith(
			expect.anything(),
			{ email: "owner@example.com", workspaceName: "Acme", plan: "scale" },
		);
	});

	it("does not ping cancellation for a workspace that had no paid plan", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const { ctx, settle } = makeCtx();
		const body = JSON.stringify({
			id: "evt_4",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_1", customer: "cus_1" } },
		});
		await postWithCtx(body, await signed(body), ctx);
		await settle();
		expect(notifySubscriptionCancelled).not.toHaveBeenCalled();
	});

	it("400s a tampered body, missing/wrong signature, or stale timestamp", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "none" } });
		const body = completed("growth");
		const sig = await signed(body);
		expect((await post(body.replace("ws_1", "ws_evil"), sig)).status).toBe(400);
		expect((await post(body, null)).status).toBe(400);
		expect(
			(await post(body, await signed(body, { secret: "whsec_attacker" })))
				.status,
		).toBe(400);
		expect(
			(
				await post(
					body,
					await signed(body, {
						tSec: Math.floor(Date.now() / 1000) - 400,
					}),
				)
			).status,
		).toBe(400);
	});
});
