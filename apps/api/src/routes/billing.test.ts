import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
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
		STRIPE_PRO_PRICE_ID: "price_pro_fixture",
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
	const headers = {
		"x-test-user": "u1",
		"x-workspace-id": "ws_1",
		"content-type": "application/json",
	};

	it("403s a non-owner", async () => {
		mockDb({ workspace: { id: "ws_1" } }); // no member row ⇒ not owner
		const res = await req("/billing/checkout", { method: "POST", headers });
		expect(res.status).toBe(403);
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it("reuses an existing Stripe customer (no duplicate created)", async () => {
		mockDb({
			member: { role: "owner" },
			workspace: { id: "ws_1", stripeCustomerId: "cus_existing" },
		});
		vi.mocked(createCheckoutSession).mockResolvedValue({
			id: "cs_1",
			url: "https://checkout.stripe.com/cs_1",
		});

		const res = await req("/billing/checkout", { method: "POST", headers });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			url: "https://checkout.stripe.com/cs_1",
		});
		expect(createCustomer).not.toHaveBeenCalled();
		expect(createCheckoutSession).toHaveBeenCalledWith(
			"sk_test_fixture",
			expect.objectContaining({
				customer: "cus_existing",
				priceId: "price_pro_fixture",
				workspaceId: "ws_1",
				successUrl: "https://dash.example.com/settings/billing?status=success",
				cancelUrl: "https://dash.example.com/settings/billing?status=cancel",
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
			id: "cs_2",
			url: "https://checkout.stripe.com/cs_2",
		});

		const res = await req("/billing/checkout", { method: "POST", headers });
		expect(res.status).toBe(200);
		expect(createCustomer).toHaveBeenCalledTimes(1);
		expect(createCustomer).toHaveBeenCalledWith("sk_test_fixture", {
			email: "owner@example.com",
			metadata: { workspaceId: "ws_1" },
		});
		// Persisted so the next checkout reuses it.
		expect(state.workspace.stripeCustomerId).toBe("cus_new");
		expect(createCheckoutSession).toHaveBeenCalledWith(
			"sk_test_fixture",
			expect.objectContaining({ customer: "cus_new" }),
		);
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
		expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p/1" });
		expect(createPortalSession).toHaveBeenCalledWith("sk_test_fixture", {
			customer: "cus_1",
			returnUrl: "https://dash.example.com/settings/billing",
		});
	});
});

describe("POST /billing/webhook", () => {
	const completed = JSON.stringify({
		id: "evt_1",
		type: "checkout.session.completed",
		data: {
			object: {
				client_reference_id: "ws_1",
				customer: "cus_1",
				subscription: "sub_1",
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

	it("flips the workspace to pro on checkout.session.completed", async () => {
		const state = mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const res = await post(completed, await signed(completed));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("pro");
		expect(state.workspace.stripeCustomerId).toBe("cus_1");
		expect(state.workspace.stripeSubscriptionId).toBe("sub_1");
	});

	it("is idempotent — the same event twice leaves plan=pro", async () => {
		const state = mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const sig = await signed(completed);
		expect((await post(completed, sig)).status).toBe(200);
		expect((await post(completed, sig)).status).toBe(200);
		expect(state.workspace.plan).toBe("pro");
	});

	it("flips back to free and clears the subscription on subscription.deleted", async () => {
		const body = JSON.stringify({
			id: "evt_2",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_1", customer: "cus_1" } },
		});
		const state = mockDb({
			workspace: { id: "ws_1", plan: "pro", stripeSubscriptionId: "sub_1" },
		});
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("free");
		expect(state.workspace.stripeSubscriptionId).toBeNull();
	});

	it("acks an unhandled event type without changing plan", async () => {
		const body = JSON.stringify({
			id: "evt_x",
			type: "invoice.paid",
			data: { object: {} },
		});
		const state = mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const res = await post(body, await signed(body));
		expect(res.status).toBe(200);
		expect(state.workspace.plan).toBe("free");
	});

	it("400s a tampered body", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const sig = await signed(completed);
		const res = await post(completed.replace("ws_1", "ws_evil"), sig);
		expect(res.status).toBe(400);
	});

	it("400s a missing signature", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "free" } });
		expect((await post(completed, null)).status).toBe(400);
	});

	it("400s a signature from the wrong secret", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const sig = await signed(completed, { secret: "whsec_attacker" });
		expect((await post(completed, sig)).status).toBe(400);
	});

	it("400s a stale timestamp (replay beyond tolerance)", async () => {
		mockDb({ workspace: { id: "ws_1", plan: "free" } });
		const sig = await signed(completed, {
			tSec: Math.floor(Date.now() / 1000) - 400,
		});
		expect((await post(completed, sig)).status).toBe(400);
	});
});
