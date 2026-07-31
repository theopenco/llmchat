import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit } from "@/lib/kv";
import { insertMessage } from "@/lib/messages";
import { resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";

import { INTERNAL_ENTITLEMENTS, planEntitlements } from "@llmchat/shared";

import { voice } from "./voice";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/plan", () => ({ resolveAccess: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/messages", () => ({
	insertMessage: vi.fn(async () => ({ messageCount: 1 })),
}));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));

const ENV = {
	vars: {
		LLMGATEWAY_API_KEY: "llmgw_test",
		LLMGATEWAY_BASE_URL: "https://api.llmgateway.io/v1",
	},
	DB: {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const project = {
	id: "p1",
	workspaceId: "ws_1",
	systemPrompt: "be nice",
	activeSystemPromptId: null,
	knowledgeText: "",
};

function mockDb({
	hasProject = true,
	conv = null as Record<string, unknown> | null,
} = {}) {
	const inserted: unknown[] = [];
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => (hasProject ? project : undefined) },
			systemPrompt: { findFirst: async () => undefined },
			source: { findMany: async () => [] },
			conversation: { findFirst: async () => conv ?? undefined },
		},
		insert: () => ({
			values: (v: unknown) => {
				inserted.push(v);
				return Promise.resolve([]);
			},
		}),
	} as unknown as ReturnType<typeof db>);
	return inserted;
}

function setPlan(plan: string, exempt = false) {
	vi.mocked(resolveAccess).mockResolvedValue({
		exempt,
		plan,
		entitlements: exempt ? INTERNAL_ENTITLEMENTS : planEntitlements(plan),
		stripeCustomerId: null,
	});
}

/** Gateway mint endpoint stub — the flat { value, expires_at } shape. */
function mockMint(
	body: unknown = { value: "ek_test_123", expires_at: 1_900_000_000 },
	status = 200,
) {
	const fetchMock = vi.fn(
		async () => new Response(JSON.stringify(body), { status }),
	);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function makeCtx() {
	const pending: Promise<unknown>[] = [];
	return {
		ctx: {
			waitUntil: (p: Promise<unknown>) => pending.push(Promise.resolve(p)),
			passThroughOnException: () => {},
			props: {},
		},
		settle: () => Promise.allSettled(pending),
	};
}

type CtxArg = Parameters<typeof voice.request>[3];

function send(ctx: ReturnType<typeof makeCtx>["ctx"]) {
	return voice.request(
		"/voice/session",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ projectKey: "pk_live", clientId: "client_1" }),
		},
		ENV,
		ctx as unknown as CtxArg,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("POST /voice/session — Scale-only realtime voice", () => {
	it("402s every plan below Scale — the premium gate", async () => {
		mockMint();
		for (const plan of ["none", "starter", "growth", "free"]) {
			mockDb();
			setPlan(plan);
			const { ctx } = makeCtx();
			const res = await send(ctx);
			expect(res.status, `plan ${plan}`).toBe(402);
			expect(await res.json()).toEqual({ error: "voice_not_available" });
		}
		// The gate fires BEFORE any gateway call — no secret is ever minted.
		expect(vi.mocked(fetch)).not.toHaveBeenCalled();
	});

	it("mints an ephemeral secret for a Scale workspace and returns the ws URL", async () => {
		const fetchMock = mockMint();
		const inserted = mockDb();
		setPlan("scale");
		const { ctx, settle } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			url: "wss://api.llmgateway.io/v1/realtime?model=gpt-realtime",
			clientSecret: "ek_test_123",
			expiresAt: 1_900_000_000,
			model: "gpt-realtime",
			voice: "marin",
		});
		// The assembled agent instructions ride the RESPONSE (the widget applies
		// them via session.update — the gateway mint accepts model only).
		expect(body.instructions).toContain("be nice");
		expect(body.instructions).toContain("# Voice call");
		// Server-to-server mint carries the LONG-LIVED key (never returned to
		// the browser) and pins the model — the gateway's schema takes NOTHING
		// else (any extra key is a 400, empirically probed).
		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(url).toBe("https://api.llmgateway.io/v1/realtime/client_secrets");
		expect((init.headers as Record<string, string>).authorization).toBe(
			"Bearer llmgw_test",
		);
		const minted = JSON.parse(String(init.body));
		expect(minted).toEqual({
			session: { type: "realtime", model: "gpt-realtime" },
		});
		// Bookkeeping: one kind='voice' usage row (excluded from the text quota).
		await settle();
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({ kind: "voice", model: "gpt-realtime" });
		expect(captureEvent).toHaveBeenCalledWith(
			ENV,
			expect.objectContaining({ event: "voice_call_started" }),
		);
	});

	it("falls back to the default gateway base when LLMGATEWAY_BASE_URL is unset", async () => {
		// Prod regression: the env var was missing and the undefined dereference
		// 500'd the route while chat kept working on the provider's own default.
		const fetchMock = mockMint();
		mockDb();
		setPlan("scale");
		const { ctx } = makeCtx();
		const envWithoutBase = {
			vars: { LLMGATEWAY_API_KEY: "llmgw_test" },
			DB: {},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		const res = await voice.request(
			"/voice/session",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ projectKey: "pk_live", clientId: "c1" }),
			},
			envWithoutBase,
			ctx as unknown as CtxArg,
		);
		expect(res.status).toBe(200);
		const [url] = fetchMock.mock.calls[0] as unknown as [string];
		expect(url).toBe("https://api.llmgateway.io/v1/realtime/client_secrets");
		expect(((await res.json()) as { url: string }).url).toBe(
			"wss://api.llmgateway.io/v1/realtime?model=gpt-realtime",
		);
	});

	it("accepts the nested { client_secret: { value } } mint response shape", async () => {
		mockMint({ client_secret: { value: "ek_nested", expires_at: 42 } });
		mockDb();
		setPlan("scale");
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			clientSecret: "ek_nested",
			expiresAt: 42,
		});
	});

	it("writes the inbox breadcrumb only when a conversation exists", async () => {
		mockMint();
		mockDb({ conv: { id: "c1", name: "Ada", email: "ada@x.com" } });
		setPlan("scale");
		const { ctx, settle } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(200);
		await settle();
		expect(insertMessage).toHaveBeenCalledWith(
			ENV,
			expect.objectContaining({ conversationId: "c1", role: "system" }),
		);
	});

	it("502s (never 500s) when the gateway mint fails", async () => {
		mockMint({ error: "nope" }, 500);
		mockDb();
		setPlan("scale");
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: "voice unavailable" });
	});

	it("429s when a voice rate bucket is exhausted (fail-closed budgets)", async () => {
		mockMint();
		mockDb();
		setPlan("scale");
		vi.mocked(rateLimit).mockResolvedValue({ ok: false, remaining: 0 });
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(429);
		expect(vi.mocked(fetch)).not.toHaveBeenCalled();
	});

	it("exempts internal workspaces from the call budgets entirely", async () => {
		// Dogfooding on the operator's own workspaces must never be throttled —
		// even with every bucket exhausted, an exempt workspace mints (and the
		// buckets aren't even consulted, so it can't dirty the counters either).
		mockMint();
		mockDb();
		setPlan("internal", true);
		vi.mocked(rateLimit).mockResolvedValue({ ok: false, remaining: 0 });
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(200);
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it("404s an unknown project key after the per-IP gate", async () => {
		mockMint();
		mockDb({ hasProject: false });
		setPlan("scale");
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(404);
	});

	it("429s when the per-IP lookup gate trips", async () => {
		mockMint();
		mockDb();
		setPlan("scale");
		vi.mocked(publicLookupRateLimit).mockResolvedValue({
			ok: false,
			remaining: 0,
		});
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(429);
	});
});
