import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { streamChat } from "@/lib/llm";
import { isResponseBlocked, resolveAccess } from "@/lib/plan";

import { planEntitlements } from "@llmchat/shared";

import { chat } from "./chat";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
	shouldSendHolding: vi.fn(async () => true),
}));
vi.mock("@/lib/llm", async (orig) => ({
	// isQuotableRole is the real allowlist — mocking it would let a `system` row
	// through and quietly void the test that proves it can't.
	...(await orig<typeof import("@/lib/llm")>()),
	streamChat: vi.fn(),
	summarizeForVisitor: vi.fn(async () => null),
}));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));
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

type Row = Record<string, unknown>;
type Pred = (row: Row) => boolean;

/**
 * A faithful-enough stand-in for drizzle's relational `findFirst`: it EVALUATES the
 * route's `where` callback against real rows instead of trusting a canned return.
 * That matters — the whole tenant guarantee lives in that predicate, so a mock that
 * just returns a row on demand would pass even if the route dropped the
 * `conversationId` scope and became a cross-conversation read.
 */
function findFirstOver(rows: Row[]) {
	return async (args?: {
		where?: (
			table: Record<string, string>,
			ops: {
				and: (...preds: Pred[]) => Pred;
				eq: (col: string, value: unknown) => Pred;
			},
		) => Pred;
	}) => {
		if (!args?.where) {
			return rows[0];
		}
		// Column proxy: `m.id` → the string "id", so eq() can index the row by name.
		const table = new Proxy({} as Record<string, string>, {
			get: (_t, prop: string) => prop,
		});
		const pred = args.where(table, {
			eq: (col, value) => (row) => row[col] === value,
			and:
				(...preds) =>
				(row) =>
					preds.every((p) => p(row)),
		});
		return rows.find(pred);
	};
}

/** The conversation under test is always c1 (project p1, client_1). */
const CONV = "c1";

function mockDb(opts: { messages?: Row[]; convRow?: Row } = {}) {
	const inserted: Row[] = [];
	const values = vi.fn((row: Row) => {
		inserted.push(row);
		return Object.assign(Promise.resolve([]), {
			returning: async () => [{ id: "ue1" }],
		});
	});
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => project },
			conversation: {
				findFirst: async () => ({
					id: CONV,
					messageCount: 2,
					...opts.convRow,
				}),
			},
			source: { findMany: async () => [] },
			systemPrompt: { findFirst: async () => undefined },
			integration: { findMany: async () => [] },
			message: { findFirst: findFirstOver(opts.messages ?? []) },
		},
		insert: () => ({ values }),
		update: () => ({ set: () => ({ where: async () => [] }) }),
	} as unknown as ReturnType<typeof db>);
	return { inserted };
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

/** The message the visitor is quoting: an agent reply in THEIR conversation. */
const OWN_ASSISTANT = {
	id: "m_own",
	conversationId: CONV,
	role: "assistant",
	content: "Your order ships on Tuesday.",
};

function body(replyToMessageId?: string) {
	return {
		projectKey: "pk_live",
		clientId: "client_1",
		messages: [{ role: "user", parts: [{ type: "text", text: "which one?" }] }],
		...(replyToMessageId ? { replyToMessageId } : {}),
	};
}

/** The user row the route persisted (the first insert of the turn). */
function userRow(inserted: Row[]) {
	return inserted.find((r) => r.role === "user");
}

/** The `quote` handed to the model, or undefined when none was. */
function quoteArg() {
	return vi.mocked(streamChat).mock.calls[0]?.[1]?.quote;
}

beforeEach(() => {
	vi.clearAllMocks();
	setAccess();
	vi.mocked(isResponseBlocked).mockResolvedValue(false);
	vi.mocked(streamChat).mockResolvedValue({
		text: Promise.resolve("hello"),
		usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
		totalUsage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
		toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
});

function setAccess() {
	vi.mocked(resolveAccess).mockResolvedValue({
		exempt: false,
		plan: "starter",
		entitlements: planEntitlements("starter"),
		stripeCustomerId: null,
	});
}

describe("POST /v1/chat — quote-reply happy path", () => {
	it("persists the reference and hands the resolved quote to the model", async () => {
		const { inserted } = mockDb({ messages: [OWN_ASSISTANT] });
		const { ctx, settle } = makeCtx();

		const res = await send(body("m_own"), ctx);
		await settle();

		expect(res.status).toBe(200);
		expect(userRow(inserted)).toMatchObject({
			conversationId: CONV,
			role: "user",
			// The stored content is the visitor's RAW text — the quote is a reference,
			// never inlined into the message body.
			content: "which one?",
			replyToMessageId: "m_own",
		});
		expect(quoteArg()).toEqual({
			role: "assistant",
			excerpt: OWN_ASSISTANT.content,
		});
	});
});

describe("POST /v1/chat — quote-reply tenant isolation (silent drop)", () => {
	/**
	 * Each case supplies a message row the attacker points at. The row EXISTS in the
	 * table — what must stop it is the conversation scope / role allowlist in the
	 * route's predicate, not the absence of the row.
	 */
	const cases: Array<{ name: string; rows: Row[]; id: string }> = [
		{
			name: "a message in ANOTHER project's conversation",
			rows: [
				{
					id: "m_foreign",
					conversationId: "c_other_project",
					role: "assistant",
					content: "SECRET from another tenant",
				},
			],
			id: "m_foreign",
		},
		{
			name: "a message in another VISITOR's conversation in the same project",
			rows: [
				{
					id: "m_neighbour",
					conversationId: "c_other_visitor",
					role: "user",
					content: "my credit card is 4111 1111 1111 1111",
				},
			],
			id: "m_neighbour",
		},
		{
			name: "an id that matches no row at all",
			rows: [],
			id: "m_does_not_exist",
		},
		{
			name: "an internal system marker in the visitor's OWN conversation",
			rows: [
				{
					id: "m_system",
					conversationId: CONV,
					role: "system",
					content: "Visitor requested a human operator",
				},
			],
			id: "m_system",
		},
	];

	for (const c of cases) {
		it(`drops ${c.name} — 200, null reference, nothing in the prompt`, async () => {
			const { inserted } = mockDb({ messages: c.rows });
			const { ctx, settle } = makeCtx();

			const res = await send(body(c.id), ctx);
			await settle();

			// Never a 4xx: the visitor's message must still go through, and the API
			// must not confirm whether the id exists (no existence oracle).
			expect(res.status).toBe(200);
			expect(userRow(inserted)?.replyToMessageId).toBeNull();
			// Nothing leaks into the model call.
			expect(quoteArg()).toBeUndefined();
			const call = JSON.stringify(vi.mocked(streamChat).mock.calls[0]?.[1]);
			for (const row of c.rows) {
				expect(call).not.toContain(row.content as string);
			}
		});
	}

	it("drops a quote of a since-deleted message at send time", async () => {
		// The visitor's client still holds the id, but the row is gone from the table.
		const { inserted } = mockDb({ messages: [] });
		const { ctx, settle } = makeCtx();

		const res = await send(body("m_deleted"), ctx);
		await settle();

		expect(res.status).toBe(200);
		expect(userRow(inserted)?.replyToMessageId).toBeNull();
		expect(quoteArg()).toBeUndefined();
	});
});

describe("POST /v1/chat — quote-reply on a muted (escalated) turn", () => {
	it("still persists the validated reference when the bot is muted", async () => {
		// Escalated and unresolved: the route returns the holding stream BEFORE the
		// model call. The visitor's message is still persisted for the operator — and
		// so is what they were replying to, which is exactly what the operator needs.
		const { inserted } = mockDb({
			messages: [OWN_ASSISTANT],
			convRow: { escalatedAt: new Date(), archivedAt: null },
		});
		const { ctx, settle } = makeCtx();

		const res = await send(body("m_own"), ctx);
		await settle();

		expect(res.status).toBe(200);
		expect(streamChat).not.toHaveBeenCalled(); // muted — no model call
		expect(userRow(inserted)).toMatchObject({
			role: "user",
			replyToMessageId: "m_own",
		});
	});
});

describe("POST /v1/chat — no quote", () => {
	it("persists null and calls the model with no quote", async () => {
		const { inserted } = mockDb({ messages: [OWN_ASSISTANT] });
		const { ctx, settle } = makeCtx();

		const res = await send(body(), ctx);
		await settle();

		expect(res.status).toBe(200);
		expect(userRow(inserted)?.replyToMessageId).toBeNull();
		expect(quoteArg()).toBeUndefined();
	});
});
