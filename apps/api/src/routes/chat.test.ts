import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { publicLookupRateLimit } from "@/lib/kv";
import { streamChat } from "@/lib/llm";
import { isResponseBlocked, resolveAccess } from "@/lib/plan";
import { reportMeterEvent } from "@/lib/stripe";

import { planEntitlements } from "@llmchat/shared";

import { chat } from "./chat";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/llm", () => ({ streamChat: vi.fn() }));
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
}: { hasProject?: boolean; sources?: unknown[] } = {}) {
	const valuesResult = () =>
		Object.assign(Promise.resolve([]), {
			returning: async () => [{ id: "ue1" }],
		});
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => (hasProject ? project : undefined) },
			conversation: { findFirst: async () => ({ id: "c1", messageCount: 0 }) },
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
