import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { streamChat } from "@/lib/llm";
import { isResponseBlocked } from "@/lib/plan";
import { reportMeterEvent } from "@/lib/stripe";

import { chat } from "./chat";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/llm", () => ({ streamChat: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/plan", () => ({ isResponseBlocked: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ reportMeterEvent: vi.fn(async () => ({})) }));

const ENV = {
	vars: {
		STRIPE_SECRET_KEY: "sk_test",
		STRIPE_METER_EVENT: "clanker_response",
	},
	DB: {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const project = {
	id: "p1",
	workspaceId: "ws_1",
	model: "gpt-5.4-mini",
	systemPrompt: "be nice",
	activeSystemPromptId: null,
	knowledgeText: "",
	escalationThreshold: 3,
	notifyEmail: null,
};

/** db whose project/workspace are configurable; all writes resolve. */
function mockDb({
	hasProject = true,
	stripeCustomerId = null as string | null,
}: { hasProject?: boolean; stripeCustomerId?: string | null } = {}) {
	const valuesResult = () =>
		Object.assign(Promise.resolve([]), {
			returning: async () => [{ id: "ue1" }],
		});
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => (hasProject ? project : undefined) },
			workspace: {
				findFirst: async () => ({ plan: PLAN, stripeCustomerId }),
			},
			conversation: { findFirst: async () => ({ id: "c1", messageCount: 0 }) },
			source: { findMany: async () => [] },
			systemPrompt: { findFirst: async () => undefined },
		},
		insert: () => ({ values: valuesResult }),
		update: () => ({ set: () => ({ where: async () => [] }) }),
	} as unknown as ReturnType<typeof db>);
}

// The plan the mocked workspace reports — set per test.
let PLAN = "starter";

/** Fake executionCtx that collects waitUntil promises so tests can await them. */
function makeCtx() {
	const pending: Promise<unknown>[] = [];
	return {
		ctx: {
			waitUntil: (p: Promise<unknown>) => pending.push(Promise.resolve(p)),
			passThroughOnException: () => {},
		},
		settle: () => Promise.allSettled(pending),
	};
}

function send(body: unknown, ctx: ReturnType<typeof makeCtx>["ctx"]) {
	return chat.request(
		"/chat",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
		ctx,
	);
}

const validBody = {
	projectKey: "pk_live",
	clientId: "client_1",
	messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
};

beforeEach(() => {
	vi.clearAllMocks();
	PLAN = "starter";
	mockDb();
});

describe("POST /v1/chat — quota hard-stop", () => {
	it("404s an invalid project key", async () => {
		mockDb({ hasProject: false });
		const { ctx } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(404);
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("402 message_limit_reached when blocked — never calls the model", async () => {
		vi.mocked(isResponseBlocked).mockResolvedValue(true);
		const { ctx } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "message_limit_reached" });
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("streams when under the cap", async () => {
		vi.mocked(isResponseBlocked).mockResolvedValue(false);
		vi.mocked(streamChat).mockResolvedValue({
			text: Promise.resolve("hello"),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
			toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		const { ctx, settle } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);
		await settle();
		// Starter has no overage → no meter event.
		expect(reportMeterEvent).not.toHaveBeenCalled();
	});
});

describe("POST /v1/chat — overage metering", () => {
	it("reports a meter event on overage tiers with a Stripe customer", async () => {
		PLAN = "growth";
		mockDb({ stripeCustomerId: "cus_9" });
		vi.mocked(isResponseBlocked).mockResolvedValue(false);
		vi.mocked(streamChat).mockResolvedValue({
			text: Promise.resolve("hello"),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
			toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		const { ctx, settle } = makeCtx();
		await send(validBody, ctx);
		await settle();
		expect(reportMeterEvent).toHaveBeenCalledWith(
			"sk_test",
			expect.objectContaining({
				eventName: "clanker_response",
				customerId: "cus_9",
				value: 1,
			}),
		);
	});

	it("does not meter when the overage workspace has no Stripe customer", async () => {
		PLAN = "growth";
		mockDb({ stripeCustomerId: null });
		vi.mocked(isResponseBlocked).mockResolvedValue(false);
		vi.mocked(streamChat).mockResolvedValue({
			text: Promise.resolve("hello"),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
			toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any);
		const { ctx, settle } = makeCtx();
		await send(validBody, ctx);
		await settle();
		expect(reportMeterEvent).not.toHaveBeenCalled();
	});
});
