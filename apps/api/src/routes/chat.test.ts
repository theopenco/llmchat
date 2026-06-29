import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { publicLookupRateLimit } from "@/lib/kv";
import { streamChat, summarizeForVisitor } from "@/lib/llm";
import { isResponseBlocked, resolveAccess } from "@/lib/plan";
import { reportMeterEvent } from "@/lib/stripe";

import { planEntitlements } from "@llmchat/shared";

import { chat } from "./chat";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/llm", () => ({
	streamChat: vi.fn(),
	summarizeForVisitor: vi.fn(async () => null),
}));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));
// Keep escapeHtml/buildReplyToAddress real; spy only on sendEmail to capture the
// escalation transcript that reaches the operator.
vi.mock("@/lib/email", async (orig) => ({
	...(await orig<typeof import("@/lib/email")>()),
	sendEmail: vi.fn(async () => ({ id: "email_1" })),
}));
vi.mock("@/lib/slack", () => ({ sendEscalationSlack: vi.fn(async () => {}) }));
vi.mock("@/lib/plan", () => ({
	isResponseBlocked: vi.fn(),
	resolveAccess: vi.fn(),
}));
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

/** db whose project is configurable; all writes resolve. resolveAccess is mocked
 * separately, so the workspace row here is unused. */
function mockDb({
	hasProject = true,
	sources = [],
	convRow = {},
}: {
	hasProject?: boolean;
	sources?: unknown[];
	convRow?: Record<string, unknown>;
} = {}) {
	const valuesResult = () =>
		Object.assign(Promise.resolve([]), {
			returning: async () => [{ id: "ue1" }],
		});
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => (hasProject ? project : undefined) },
			conversation: {
				findFirst: async () => ({ id: "c1", messageCount: 0, ...convRow }),
			},
			source: { findMany: async () => sources },
			systemPrompt: { findFirst: async () => undefined },
		},
		insert: () => ({ values: valuesResult }),
		update: () => ({ set: () => ({ where: async () => [] }) }),
	} as unknown as ReturnType<typeof db>);
}

/** Set the resolved access for the workspace under test. */
function setAccess(opts: {
	exempt?: boolean;
	plan?: string;
	stripeCustomerId?: string | null;
}) {
	const plan = opts.plan ?? "starter";
	vi.mocked(resolveAccess).mockResolvedValue({
		exempt: opts.exempt ?? false,
		plan,
		entitlements: planEntitlements(plan),
		stripeCustomerId: opts.stripeCustomerId ?? null,
	});
}

const streamOk = () =>
	vi.mocked(streamChat).mockResolvedValue({
		text: Promise.resolve("hello"),
		usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
		toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);

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

type CtxArg = Parameters<typeof chat.request>[3];

function send(body: unknown, ctx: ReturnType<typeof makeCtx>["ctx"]) {
	return chat.request(
		"/chat",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
		ctx as unknown as CtxArg,
	);
}

const validBody = {
	projectKey: "pk_live",
	clientId: "client_1",
	messages: [{ role: "user", parts: [{ type: "text", text: "hi" }] }],
};

beforeEach(() => {
	vi.clearAllMocks();
	mockDb();
	setAccess({ plan: "starter" });
	vi.mocked(isResponseBlocked).mockResolvedValue(false);
});

describe("POST /v1/chat — paywall (build-first-then-pay)", () => {
	it("404s an invalid project key", async () => {
		mockDb({ hasProject: false });
		const { ctx } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(404);
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("rejects an oversized message text part (8k cap) — never calls the model", async () => {
		// Unbounded attacker text on the shared operator key was the gap; the
		// per-message cap rejects it at validation, before any model call.
		const { ctx } = makeCtx();
		const res = await send(
			{
				...validBody,
				messages: [
					{ role: "user", parts: [{ type: "text", text: "x".repeat(8_001) }] },
				],
			},
			ctx,
		);
		expect(res.status).toBe(400);
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("402 subscription_required for a no-sub (none) workspace — never calls the model", async () => {
		setAccess({ plan: "none" });
		const { ctx } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "subscription_required" });
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("402 message_limit_reached when a subscribed tier hits its cap", async () => {
		setAccess({ plan: "starter" });
		vi.mocked(isResponseBlocked).mockResolvedValue(true);
		const { ctx } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "message_limit_reached" });
		expect(streamChat).not.toHaveBeenCalled();
	});

	it("streams when subscribed and under the cap (no meter on a fixed tier)", async () => {
		setAccess({ plan: "starter" });
		streamOk();
		const { ctx, settle } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);
		await settle();
		expect(reportMeterEvent).not.toHaveBeenCalled();
	});

	it("EXEMPT owner workspace serves even if the quota check would block — and is never metered", async () => {
		setAccess({ exempt: true, plan: "internal", stripeCustomerId: "cus_x" });
		vi.mocked(isResponseBlocked).mockResolvedValue(true); // would block a normal tier
		streamOk();
		const { ctx, settle } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);
		await settle();
		expect(reportMeterEvent).not.toHaveBeenCalled(); // exempt → never billed
	});
});

describe("POST /v1/chat — overage metering", () => {
	it("reports a meter event on overage tiers with a Stripe customer", async () => {
		setAccess({ plan: "growth", stripeCustomerId: "cus_9" });
		streamOk();
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
		setAccess({ plan: "growth", stripeCustomerId: null });
		streamOk();
		const { ctx, settle } = makeCtx();
		await send(validBody, ctx);
		await settle();
		expect(reportMeterEvent).not.toHaveBeenCalled();
	});
});

describe("POST /v1/chat — retrieval reaches the model input (Text + Q&A)", () => {
	// Source rows exactly as the DB returns them for the new manual types:
	// url-less (url:null), active, content set. The failure mode this guards is
	// silent — a kind/url filter in the load query would drop these and the agent
	// would never see them despite the UI saving them.
	const textRow = {
		id: "s_text",
		projectId: "p1",
		kind: "text",
		url: null,
		title: "Restock cadence",
		content: "We restock weekly on Mondays.",
		question: null,
		answer: null,
		sourceMessageId: null,
		active: true,
	};
	const qaRow = {
		id: "s_qa",
		projectId: "p1",
		kind: "qa",
		url: null,
		title: "Do you ship internationally?",
		content:
			"Q: Do you ship internationally?\nA: Yes — we ship to 40 countries.",
		question: "Do you ship internationally?",
		answer: "Yes — we ship to 40 countries.",
		sourceMessageId: null,
		active: true,
	};

	it("loads url-less Text + Q&A sources and renders their content into the system prompt", async () => {
		mockDb({ sources: [textRow, qaRow] });
		setAccess({ plan: "starter" });
		streamOk();
		const { ctx, settle } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);

		// What chat.ts actually handed the model layer: both url-less sources,
		// content intact, url normalised to "" (never dropped by a filter).
		const input = vi.mocked(streamChat).mock.calls[0]![1];
		expect(input.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					url: "",
					content: expect.stringContaining("We restock weekly on Mondays"),
				}),
				expect.objectContaining({
					url: "",
					content: expect.stringContaining("Yes — we ship to 40 countries"),
				}),
			]),
		);

		// Run the REAL buildSystem over those args → the literal `system` string the
		// gateway receives. This is the model input; assert the source content is in
		// it, so retrieval is proven repeatably (not just "the rows were loaded").
		const { buildSystem } =
			await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
		const system = buildSystem(
			input.systemPrompt,
			input.knowledgeText,
			input.sources,
		);
		expect(system).toContain("# Reference sources");
		expect(system).toContain("We restock weekly on Mondays.");
		expect(system).toContain("Yes — we ship to 40 countries.");
		await settle();
	});
});

describe("POST /v1/chat — visitor identity (Bug 1: agent is identity-aware)", () => {
	it("threads the stored conv.name/email into streamChat and the system prompt", async () => {
		mockDb({ convRow: { name: "Jane Doe", email: "jane@acme.com" } });
		setAccess({ plan: "starter" });
		streamOk();
		const { ctx, settle } = makeCtx();
		// Body carries a CONFLICTING name/email; the handler must ignore it and use the
		// canonical stored conversation columns, proving identity isn't forgeable per-turn.
		const res = await send(
			{ ...validBody, name: "Forged Body", email: "forged@evil.com" },
			ctx,
		);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);

		const input = vi.mocked(streamChat).mock.calls[0]![1];
		expect(input.identity).toEqual({
			name: "Jane Doe",
			email: "jane@acme.com",
		});

		// Run the REAL buildSystem over those args → the literal system string the
		// gateway receives carries the identity block.
		const { buildSystem } =
			await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
		const system = buildSystem(
			input.systemPrompt,
			input.knowledgeText,
			input.sources,
			input.identity,
		);
		expect(system).toContain("# Visitor");
		expect(system).toContain("Name: Jane Doe");
		expect(system).toContain("Email: jane@acme.com");
		await settle();
	});

	it("an anonymous conversation injects no identity block (honesty rail)", async () => {
		// The default mock conversation has no name/email.
		streamOk();
		const { ctx, settle } = makeCtx();
		const res = await send(validBody, ctx);
		expect(res.status).toBe(200);

		const input = vi.mocked(streamChat).mock.calls[0]![1];
		const { buildSystem } =
			await vi.importActual<typeof import("@/lib/llm")>("@/lib/llm");
		const system = buildSystem(
			input.systemPrompt,
			input.knowledgeText,
			input.sources,
			input.identity,
		);
		expect(system).not.toContain("# Visitor");
		await settle();
	});
});

function sendEscalate(body: unknown, ctx: ReturnType<typeof makeCtx>["ctx"]) {
	return chat.request(
		"/escalate",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
		ctx as unknown as CtxArg,
	);
}

describe("POST /v1/escalate — operator transcript is server-side", () => {
	function mockDbForEscalate(
		storedMessages: unknown[],
		notifyEmail: string | null = "ops@acme.com",
	) {
		const valuesResult = () =>
			Object.assign(Promise.resolve([]), {
				returning: async () => [{ id: "ue1" }],
			});
		vi.mocked(db).mockReturnValue({
			query: {
				project: {
					findFirst: async () => ({
						...project,
						notifyEmail,
						inboundEmailLocal: "acme",
						slackWebhookUrl: null,
					}),
				},
				conversation: {
					findFirst: async () => ({
						id: "c1",
						messageCount: 2,
						name: null,
						email: null,
					}),
				},
				message: { findMany: async () => storedMessages },
			},
			insert: () => ({ values: valuesResult }),
			update: () => ({ set: () => ({ where: async () => [] }) }),
		} as unknown as ReturnType<typeof db>);
	}

	it("builds the email transcript from STORED rows, never the forgeable request body", async () => {
		mockDbForEscalate([
			{ role: "user", content: "stored question", sequence: 1 },
			{ role: "assistant", content: "stored answer", sequence: 2 },
		]);
		const { ctx, settle } = makeCtx();

		const res = await sendEscalate(
			{
				projectKey: "pk_live",
				clientId: "client_1",
				// An attacker who knows the public key + a clientId could forge this —
				// it must NOT reach the operator's inbox.
				messages: [{ role: "user", content: "FORGED-INJECTED-CONTENT" }],
			},
			ctx,
		);

		expect(res.status).toBe(200);
		expect(sendEmail).toHaveBeenCalledTimes(1);
		const html = vi.mocked(sendEmail).mock.calls[0]![1].html;
		expect(html).toContain("stored question");
		expect(html).toContain("stored answer");
		expect(html).not.toContain("FORGED-INJECTED-CONTENT");
		await settle();
	});

	it("addresses the operator alert to the project's notifyEmail — the create-time default reaches the owner", async () => {
		mockDbForEscalate(
			[{ role: "user", content: "help", sequence: 1 }],
			"owner@acme.com",
		);
		const { ctx, settle } = makeCtx();

		const res = await sendEscalate(
			{
				projectKey: "pk_live",
				clientId: "client_1",
				messages: [{ role: "user", content: "help" }],
			},
			ctx,
		);

		expect(res.status).toBe(200);
		expect(sendEmail).toHaveBeenCalledTimes(1);
		// A freshly-created project's notifyEmail (seeded from the owner at creation)
		// is exactly what the alert is addressed to — so escalation reaches someone.
		expect(vi.mocked(sendEmail).mock.calls[0]![1].to).toBe("owner@acme.com");
		await settle();
	});

	it("sends NO operator email when notifyEmail is null — the day-one gap the create-time default closes", async () => {
		mockDbForEscalate([{ role: "user", content: "help", sequence: 1 }], null);
		const { ctx, settle } = makeCtx();

		const res = await sendEscalate(
			{
				projectKey: "pk_live",
				clientId: "client_1",
				messages: [{ role: "user", content: "help" }],
			},
			ctx,
		);

		// Escalation is still recorded + visible in the inbox (loop intact)…
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
		// …but with no notifyEmail there is no alert — exactly why creation now
		// defaults notifyEmail to the owner's email.
		expect(sendEmail).not.toHaveBeenCalled();
		await settle();
	});

	it("acknowledges the customer and seeds the email thread when a visitor email + inbound domain are present", async () => {
		const valuesSpy = vi.fn(() =>
			Object.assign(Promise.resolve([]), {
				returning: async () => [{ id: "ue1" }],
			}),
		);
		vi.mocked(db).mockReturnValue({
			query: {
				project: {
					findFirst: async () => ({
						...project,
						name: "Acme Tools",
						notifyEmail: "ops@acme.com",
						inboundEmailLocal: "acme",
						slackWebhookUrl: null,
					}),
				},
				conversation: {
					findFirst: async () => ({
						id: "c1",
						messageCount: 2,
						name: null,
						email: null,
					}),
				},
				message: { findMany: async () => [] },
			},
			insert: () => ({ values: valuesSpy }),
			update: () => ({ set: () => ({ where: async () => [] }) }),
		} as unknown as ReturnType<typeof db>);

		const env = {
			vars: { INBOUND_EMAIL_DOMAIN: "mail.acme.com" },
			DB: {},
		} as unknown as typeof ENV;
		const { ctx, settle } = makeCtx();

		const res = await chat.request(
			"/escalate",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectKey: "pk_live",
					clientId: "client_1",
					email: "visitor@example.com",
					messages: [],
				}),
			},
			env,
			ctx as unknown as CtxArg,
		);

		expect(res.status).toBe(200);
		// Two emails: operator alert + customer acknowledgement.
		expect(sendEmail).toHaveBeenCalledTimes(2);
		const ack = vi
			.mocked(sendEmail)
			.mock.calls.map((call) => call[1])
			.find((args) => args.to === "visitor@example.com");
		expect(ack).toBeDefined();
		expect(ack!.subject).toContain("Acme Tools");
		expect(ack!.replyTo).toBe("reply+acme@mail.acme.com");
		// Message-ID seeds threading; it must match a stored message's emailMessageId.
		const messageId = ack!.headers?.["Message-ID"];
		expect(messageId).toMatch(/^<[^@]+@mail\.acme\.com>$/);
		const stored = valuesSpy.mock.calls
			.map((call) => call[0] as { emailMessageId?: string; role?: string })
			.find((row) => row.role === "system");
		expect(`<${stored!.emailMessageId}>`).toBe(messageId);
		await settle();
	});
});

describe("POST /v1/escalate — in-chat visitor summary (Bug 2)", () => {
	// Spy-capturing escalate mock: records inserted message rows (valuesSpy) and
	// conversation update payloads (setSpy) so we can assert the system row was
	// written and that the recap NEVER writes #94's summary columns.
	function mockDbForSummary(
		storedMessages: unknown[],
		notifyEmail: string | null = null,
	) {
		const valuesSpy = vi.fn((_row: unknown) =>
			Object.assign(Promise.resolve([]), {
				returning: async () => [{ id: "ue1" }],
			}),
		);
		const setSpy = vi.fn((_payload: unknown) => ({ where: async () => [] }));
		vi.mocked(db).mockReturnValue({
			query: {
				project: {
					findFirst: async () => ({
						...project,
						notifyEmail,
						inboundEmailLocal: "acme",
						slackWebhookUrl: null,
					}),
				},
				conversation: {
					findFirst: async () => ({
						id: "c1",
						messageCount: 2,
						name: null,
						email: null,
					}),
				},
				message: { findMany: async () => storedMessages },
			},
			insert: () => ({ values: valuesSpy }),
			update: () => ({ set: setSpy }),
		} as unknown as ReturnType<typeof db>);
		return { valuesSpy, setSpy };
	}

	const exchange = [
		{ role: "user", content: "my order is late", sequence: 1 },
		{ role: "assistant", content: "let me check on that", sequence: 2 },
	];

	function escalateBody() {
		return {
			projectKey: "pk_live",
			clientId: "client_1",
			messages: [{ role: "user", content: "my order is late" }],
		};
	}

	it("returns the generated recap in the response body", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce(
			"You asked about your late order and we started looking into it.",
		);
		mockDbForSummary(exchange);
		const { ctx, settle } = makeCtx();
		const res = await sendEscalate(escalateBody(), ctx);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			ok: true,
			summary:
				"You asked about your late order and we started looking into it.",
		});
		await settle();
	});

	it("ISOLATION: a summary failure never fails the escalation (still 200, summary null, system row + email)", async () => {
		vi.mocked(summarizeForVisitor).mockRejectedValueOnce(
			new Error("gateway down"),
		);
		const { valuesSpy } = mockDbForSummary(exchange, "ops@acme.com");
		const { ctx, settle } = makeCtx();
		const res = await sendEscalate(escalateBody(), ctx);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true, summary: null });
		// the failing path was actually exercised (future-proofs the rejection branch)
		expect(summarizeForVisitor).toHaveBeenCalledTimes(1);
		// escalation still recorded + operator still notified — and NN2: exactly one
		// inserted row (the system marker), never a persisted recap message.
		expect(valuesSpy).toHaveBeenCalledTimes(1);
		const insertedSystem = valuesSpy.mock.calls
			.map((c) => c[0] as { role?: string; content?: string })
			.find((row) => row.role === "system");
		expect(insertedSystem?.content).toBe("Visitor requested a human operator");
		expect(sendEmail).toHaveBeenCalled();
		await settle();
	});

	it("hangs are bounded: a never-resolving summarizer times out → 200, summary null (NN1)", async () => {
		vi.useFakeTimers();
		try {
			// Never resolves — only the Promise.race timeout can settle the recap.
			vi.mocked(summarizeForVisitor).mockReturnValueOnce(
				new Promise<string | null>(() => {}),
			);
			mockDbForSummary(exchange);
			const { ctx } = makeCtx();
			const resPromise = sendEscalate(escalateBody(), ctx);
			// Advance past the 4.5s ceiling, flushing the timer + microtasks.
			await vi.advanceTimersByTimeAsync(5_000);
			const res = await resPromise;
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ ok: true, summary: null });
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns summary: null when the recap is empty/unavailable (honesty rail — no card)", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce(null);
		mockDbForSummary(exchange);
		const { ctx, settle } = makeCtx();
		const res = await sendEscalate(escalateBody(), ctx);
		expect(await res.json()).toMatchObject({ ok: true, summary: null });
		await settle();
	});

	it("skips generation for a thin conversation (min-content gate, parity with #94)", async () => {
		mockDbForSummary([{ role: "user", content: "hi", sequence: 1 }]);
		const { ctx, settle } = makeCtx();
		const res = await sendEscalate(escalateBody(), ctx);
		expect(await res.json()).toMatchObject({ ok: true, summary: null });
		expect(summarizeForVisitor).not.toHaveBeenCalled();
		await settle();
	});

	it("excludes the system row from the recap transcript but KEEPS it in the operator email (NN5)", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce("recap");
		mockDbForSummary(
			[
				...exchange,
				{
					role: "system",
					content: "Visitor requested a human operator",
					sequence: 3,
				},
			],
			"ops@acme.com",
		);
		const { ctx, settle } = makeCtx();
		await sendEscalate(escalateBody(), ctx);
		// buildTranscript is the REAL impl (conversation-summary is not mocked): the
		// recap transcript drops the system marker so it doesn't summarize the
		// escalation event itself.
		const transcript = vi.mocked(summarizeForVisitor).mock.calls[0]![1];
		expect(transcript).toContain("Visitor: my order is late");
		expect(transcript).toContain("Agent: let me check on that");
		expect(transcript).not.toContain("Visitor requested a human operator");
		// …while the operator email keeps EVERY row, including the marker.
		const html = vi.mocked(sendEmail).mock.calls[0]![1].html;
		expect(html).toContain("Visitor requested a human operator");
		await settle();
	});

	it("NO-CLOBBER: never writes conversation.summary / summaryMessageCount, never persists a recap row (#94 untouched)", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce("recap");
		const { setSpy, valuesSpy } = mockDbForSummary(exchange);
		const { ctx, settle } = makeCtx();
		await sendEscalate(escalateBody(), ctx);
		for (const call of setSpy.mock.calls) {
			const payload = call[0] as Record<string, unknown>;
			expect(payload).not.toHaveProperty("summary");
			expect(payload).not.toHaveProperty("summaryMessageCount");
		}
		// NN2: the recap is return-only — the sole inserted row is the system marker,
		// never a persisted recap message.
		expect(valuesSpy).toHaveBeenCalledTimes(1);
		expect((valuesSpy.mock.calls[0]![0] as { role?: string }).role).toBe(
			"system",
		);
		await settle();
	});

	it("generates the recap even when notifyEmail is null (transcript fetch hoisted out of the email block)", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce(
			"recap with no operator email",
		);
		mockDbForSummary(exchange, null);
		const { ctx, settle } = makeCtx();
		const res = await sendEscalate(escalateBody(), ctx);
		expect(summarizeForVisitor).toHaveBeenCalledTimes(1);
		expect(await res.json()).toMatchObject({
			ok: true,
			summary: "recap with no operator email",
		});
		await settle();
	});
});

describe("public widget pre-lookup IP gate", () => {
	it("returns 429 BEFORE the project lookup when the per-IP gate trips", async () => {
		vi.mocked(publicLookupRateLimit).mockResolvedValueOnce({
			ok: false,
			remaining: 0,
		});
		const projectFindFirst = vi.fn(async () => project);
		vi.mocked(db).mockReturnValue({
			query: { project: { findFirst: projectFindFirst } },
		} as unknown as ReturnType<typeof db>);
		const { ctx } = makeCtx();

		const res = await send(validBody, ctx);

		expect(res.status).toBe(429);
		// The DB was never touched — the flood is bounded before the lookup.
		expect(projectFindFirst).not.toHaveBeenCalled();
	});
});
