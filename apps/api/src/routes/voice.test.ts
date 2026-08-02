import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { publicLookupRateLimit, rateLimit } from "@/lib/kv";
import { insertMessage } from "@/lib/messages";
import { resolveAccess } from "@/lib/plan";
import { captureEvent } from "@/lib/posthog";

import { planEntitlements } from "@llmchat/shared";

import {
	boundVoiceInstructions,
	estimateRealtimeTokens,
	voice,
	VOICE_CALL_STYLE_PROMPT,
	VOICE_TOKEN_CEILING,
} from "./voice";

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
	sources = [] as Record<string, unknown>[],
	projectOverrides = {} as Record<string, unknown>,
} = {}) {
	const inserted: unknown[] = [];
	vi.mocked(db).mockReturnValue({
		query: {
			project: {
				findFirst: async () =>
					hasProject ? { ...project, ...projectOverrides } : undefined,
			},
			systemPrompt: { findFirst: async () => undefined },
			source: { findMany: async () => sources },
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
		entitlements: planEntitlements(plan),
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

describe("voice instruction budget — the realtime 16,384-token cap (item 0)", () => {
	async function mintInstructions(opts: Parameters<typeof mockDb>[0]) {
		// Earlier describes leave ok:false implementations on the gate mocks
		// (clearAllMocks clears calls, not implementations) — re-prime them.
		vi.mocked(rateLimit).mockResolvedValue({ ok: true, remaining: 1 });
		vi.mocked(publicLookupRateLimit).mockResolvedValue({
			ok: true,
			remaining: 1,
		});
		mockMint();
		mockDb(opts);
		setPlan("scale");
		const { ctx } = makeCtx();
		const res = await send(ctx);
		expect(res.status).toBe(200);
		return ((await res.json()) as { instructions: string }).instructions;
	}

	it("keeps 80k of source content under the token ceiling via the voice even-split", async () => {
		// The text path's worst case: 8 sources × 10k chars = 80k, which the old
		// assembly shipped whole (~20k tokens — upstream rejects >16,384 and the
		// call ran ungrounded). The voice budget must split floor(16000/8) =
		// 2000 chars per source.
		const sources = Array.from({ length: 8 }, (_, i) => ({
			title: `Doc ${i}`,
			url: `https://acme.test/${i}`,
			content: `S${i}-${"x".repeat(9_980)}-TAIL${i}`,
			active: true,
		}));
		const instructions = await mintInstructions({ sources });
		expect(estimateRealtimeTokens(instructions)).toBeLessThanOrEqual(
			VOICE_TOKEN_CEILING,
		);
		// Every source keeps its head (even split — no source crowds out another)…
		expect(instructions).toContain("S0-");
		expect(instructions).toContain("S7-");
		// …and none ships past its floor(16000/8)=2000-char share.
		for (let i = 0; i < 8; i++) {
			expect(instructions).not.toContain(`TAIL${i}`);
		}
		// The spoken-delivery addendum always survives.
		expect(instructions).toContain("# Voice call");
	});

	it("hard-slices knowledgeText for voice (uncapped on the text path)", async () => {
		const instructions = await mintInstructions({
			projectOverrides: {
				knowledgeText: `${"k".repeat(8_000)}KNOWLEDGE-OVERFLOW`,
			},
		});
		expect(instructions).not.toContain("KNOWLEDGE-OVERFLOW");
		expect(estimateRealtimeTokens(instructions)).toBeLessThanOrEqual(
			VOICE_TOKEN_CEILING,
		);
	});

	it("backstop: truncates over-ceiling instructions at mint and logs a content-free counter", async () => {
		// A giant operator prompt has no layer-1 budget of its own — the token
		// backstop is what guarantees the mint NEVER ships instructions it
		// expects the session to reject.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const instructions = await mintInstructions({
			projectOverrides: { systemPrompt: "y".repeat(60_000) },
		});
		expect(estimateRealtimeTokens(instructions)).toBeLessThanOrEqual(
			VOICE_TOKEN_CEILING,
		);
		// Deterministic truncation preserves the spoken-delivery addendum whole.
		expect(instructions.endsWith(VOICE_CALL_STYLE_PROMPT)).toBe(true);
		// The counter fires exactly once and never carries prompt content.
		const truncationWarns = warn.mock.calls.filter(
			(c) => typeof c[0] === "string" && c[0].includes("over token ceiling"),
		);
		expect(truncationWarns).toHaveLength(1);
		expect(String(truncationWarns[0][0])).not.toContain("yyy");
		warn.mockRestore();
	});
});

describe("estimateRealtimeTokens / boundVoiceInstructions (pure)", () => {
	it("estimates ASCII at 3 chars/token (dense-ASCII bias) and non-ASCII at a full token each", () => {
		expect(estimateRealtimeTokens("")).toBe(0);
		expect(estimateRealtimeTokens("abc")).toBe(1);
		expect(estimateRealtimeTokens("abcd")).toBe(2);
		expect(estimateRealtimeTokens("abcdef")).toBe(2);
		expect(estimateRealtimeTokens("支支支")).toBe(3);
		expect(estimateRealtimeTokens("ab支")).toBe(2);
	});

	it("passes under-ceiling instructions through untouched", () => {
		const r = boundVoiceInstructions("base prompt", "# Voice call");
		expect(r).toEqual({
			instructions: "base prompt\n\n# Voice call",
			truncated: false,
			estimatedTokens: estimateRealtimeTokens("base prompt\n\n# Voice call"),
		});
	});

	it("truncates deterministically to the ceiling, keeping the addendum whole", () => {
		const base = "z".repeat(60_000); // est 15k tokens — over the 12,288 ceiling
		const addendum = "# Voice call\nSpeak naturally.";
		const a = boundVoiceInstructions(base, addendum);
		const b = boundVoiceInstructions(base, addendum);
		expect(a).toEqual(b); // same input, same output — deterministic
		expect(a.truncated).toBe(true);
		expect(a.estimatedTokens).toBeLessThanOrEqual(VOICE_TOKEN_CEILING);
		// The walk fills the budget rather than wildly undershooting it…
		expect(a.estimatedTokens).toBeGreaterThanOrEqual(VOICE_TOKEN_CEILING - 2);
		// …and the addendum survives whole at the tail.
		expect(a.instructions.endsWith(`\n\n${addendum}`)).toBe(true);
	});

	it("handles token-dense (non-ASCII) bases with the same guarantee", () => {
		const a = boundVoiceInstructions("支".repeat(20_000), "# Voice call");
		expect(a.truncated).toBe(true);
		expect(a.estimatedTokens).toBeLessThanOrEqual(VOICE_TOKEN_CEILING);
		expect(a.instructions.endsWith("# Voice call")).toBe(true);
	});

	it("never cuts between the halves of a surrogate pair", () => {
		// An all-emoji base makes every code unit cost 1 est token; with an
		// odd remaining budget the walk lands exactly mid-pair, so without the
		// guard the kept prefix ends in a lone high surrogate — ill-formed
		// Unicode that strict upstream JSON parsers reject wholesale.
		const addendum = "# Voice call";
		const a = boundVoiceInstructions("😀".repeat(10_000), addendum);
		expect(a.truncated).toBe(true);
		const cut = a.instructions.slice(0, -(addendum.length + 2));
		const last = cut.charCodeAt(cut.length - 1);
		expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
		expect(a.estimatedTokens).toBeLessThanOrEqual(VOICE_TOKEN_CEILING);
	});
});
