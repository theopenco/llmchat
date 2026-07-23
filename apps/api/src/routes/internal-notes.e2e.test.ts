// End-to-end proof of the internal-notes leak boundary (Phase-1 exclusion
// spec, docs/internal-notes-phase1.md §4): a role="note" row must be visible
// to workspace members in the dashboard thread / search, and NOTHING else —
// not the widget feed, not the escalation recap or its operator email, not the
// inbox triage summary, not the chat prompt, not a promoted knowledge source.
//
// Real handlers against a REAL sqlite DB (drizzle sqlite-proxy over the actual
// migrations), so the role ALLOWLISTS are exercised as SQL/code, not as mocks.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	conversation,
	member,
	message,
	project,
	schema,
	user,
	workspace,
} from "@llmchat/db";

import type { Env } from "@/env";

// Header-driven fake session: `x-test-user` present ⇒ signed in as that user
// id. Workspace membership/roles come from the REAL `member` table.
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
// Public-route rate limits pass; holding throttle allows.
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
	shouldSendHolding: vi.fn(async () => true),
}));
// Spy on outbound email; keep escapeHtml/buildReplyToAddress real.
vi.mock("@/lib/email", async (orig) => ({
	...(await orig<typeof import("@/lib/email")>()),
	sendEmail: vi.fn(async () => ({ id: "email_1" })),
}));
vi.mock("@/lib/slack", () => ({ sendEscalationSlack: vi.fn(async () => {}) }));
vi.mock("@/lib/posthog", () => ({
	captureEvent: vi.fn(async () => {}),
	captureInBackground: vi.fn(),
}));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/plan", () => ({
	isResponseBlocked: vi.fn(async () => false),
	resolveAccess: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ reportMeterEvent: vi.fn(async () => ({})) }));
// LLM layer: mock the model calls, keep the role allowlists & prompt builders real.
vi.mock("@/lib/llm", async (orig) => ({
	...(await orig<typeof import("@/lib/llm")>()),
	streamChat: vi.fn(),
	summarizeConversation: vi.fn(async () => "a summary"),
	summarizeForVisitor: vi.fn(async () => null),
}));

import { planEntitlements } from "@llmchat/shared";

import { maybeSummarize } from "@/lib/conversation-summary";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { captureEvent, captureInBackground } from "@/lib/posthog";
import { sendEscalationSlack } from "@/lib/slack";
import {
	streamChat,
	summarizeConversation,
	summarizeForVisitor,
} from "@/lib/llm";
import { resolveAccess } from "@/lib/plan";

import { chat } from "./chat";
import { conversations } from "./conversations";
import { notifications } from "./notifications";
import { search } from "./search";
import { sources } from "./sources";
import { widgetMessages } from "./widget-messages";
import { widgetRating } from "./widget-rating";

// ─── real sqlite via proxy (same rig as search.e2e) ─────────────────────────
function applyMigrations(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	const dir = join(process.cwd(), "migrations");
	for (const f of readdirSync(dir)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		sqlite.exec(
			readFileSync(join(dir, f), "utf8")
				.split("--> statement-breakpoint")
				.join("\n"),
		);
	}
}

function makeProxy(sqlite: DatabaseSync) {
	const exec = async (sql: string, params: unknown[], method: string) => {
		const stmt = sqlite.prepare(sql);
		if (method === "run") {
			stmt.run(...(params as never[]));
			return { rows: [] };
		}
		const rows = stmt
			.all(...(params as never[]))
			.map((r) => Object.values(r as object));
		return { rows: method === "get" ? (rows[0] as never) : rows };
	};
	const batch = async (
		queries: { sql: string; params: unknown[]; method: string }[],
	) =>
		queries.map((q) => {
			const stmt = sqlite.prepare(q.sql);
			if (q.method === "run") {
				stmt.run(...(q.params as never[]));
				return { rows: [] };
			}
			const rows = stmt
				.all(...(q.params as never[]))
				.map((o) => Object.values(o as object));
			return { rows: q.method === "get" ? (rows[0] as never) : rows };
		});
	return drizzle(exec, batch, { schema, casing: "snake_case" });
}

// STATE (summary cooldown) is a benign in-memory stub; vars stay empty.
const ENV = {
	vars: {},
	DB: {},
	STATE: { get: async () => null, set: async () => {} },
} as unknown as Env;

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

// ── Fixture: workspace A (owner u1 "Omar Owner", agent u2 "Ana Agent") with
// one conversation holding every role incl. two notes (one authored, one
// orphaned to simulate a deleted author). Workspace B = the foreign tenant. ──
const u1 = "user-owner";
const u2 = "user-agent";
const uB = "user-b";
const wsA = "ws-a";
const wsB = "ws-b";
const pA = "proj-a";
const pB = "proj-b";
const c1 = "conv-1";
const NOTE_TOKEN = "SECRET-NOTE-TOKEN-cust-is-vip";

async function seed(sqlite: DatabaseSync) {
	const sdb = makeProxy(sqlite);
	await sdb.insert(user).values([
		{ id: u1, name: "Omar Owner", email: "o@example.com" },
		{ id: u2, name: "Ana Agent", email: "ana@example.com" },
		{ id: uB, name: "Foreign B", email: "b@example.com" },
	]);
	await sdb.insert(workspace).values([
		{ id: wsA, name: "Workspace A", ownerId: u1 },
		{ id: wsB, name: "Workspace B", ownerId: uB },
	]);
	await sdb.insert(member).values([
		{ id: "m-1", workspaceId: wsA, userId: u1, role: "owner" },
		{ id: "m-2", workspaceId: wsA, userId: u2, role: "agent" },
		{ id: "m-b", workspaceId: wsB, userId: uB, role: "owner" },
	]);
	await sdb.insert(project).values([
		{
			id: pA,
			workspaceId: wsA,
			name: "Acme Support",
			publicKey: "pk_a",
			inboundEmailLocal: "inbound_a",
			notifyEmail: "ops@example.com",
			systemPrompt: "be nice",
		},
		{
			id: pB,
			workspaceId: wsB,
			name: "Beta Support",
			publicKey: "pk_b",
			inboundEmailLocal: "inbound_b",
		},
	]);
	await sdb.insert(conversation).values([
		{
			id: c1,
			projectId: pA,
			clientId: "visitor-1",
			name: "Vic Visitor",
			// Deliberately AHEAD of MAX(sequence) (6, below) — the shape a thread
			// takes after a future row deletion (#146). The gap makes the sequence
			// assertions discriminate the messageCount+1 protocol from a
			// MAX(sequence)+1 reimplementation, which this fixture would catch.
			messageCount: 8,
		},
	]);
	await sdb.insert(message).values([
		{
			id: "m-user",
			conversationId: c1,
			role: "user",
			content: "Where is my refund?",
			sequence: 1,
		},
		{
			id: "m-assistant",
			conversationId: c1,
			role: "assistant",
			content: "Let me check that for you.",
			sequence: 2,
		},
		{
			id: "m-admin",
			conversationId: c1,
			role: "admin",
			content: "Operator here — refund approved.",
			sequence: 3,
			authorUserId: u1,
		},
		{
			// A system marker row: must stay VISIBLE on the widget feed and in the
			// operator email (VISITOR_VISIBLE_ROLES) while staying OUT of the
			// visitor recap (RECAP_ROLES) — the pair that proves the two allowlists
			// are distinct and neither collapsed into the other.
			id: "m-system",
			conversationId: c1,
			role: "system",
			content: "System marker row",
			sequence: 4,
		},
		{
			id: "m-note",
			conversationId: c1,
			role: "note",
			content: `${NOTE_TOKEN} — comp the order, do not tell legal`,
			sequence: 5,
			authorUserId: u1,
		},
		{
			id: "m-note-orphan",
			conversationId: c1,
			role: "note",
			content: "orphan note from a deleted teammate",
			sequence: 6,
			authorUserId: null,
		},
	]);
}

let sqlite: DatabaseSync;

beforeEach(async () => {
	vi.clearAllMocks();
	sqlite = new DatabaseSync(":memory:");
	applyMigrations(sqlite);
	await seed(sqlite);
	vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
	vi.mocked(resolveAccess).mockResolvedValue({
		exempt: false,
		plan: "starter",
		entitlements: planEntitlements("starter"),
		stripeCustomerId: null,
	} as never);
});

const MEMBER_HEADERS = { "x-test-user": u1, "x-workspace-id": wsA };

describe("V1 — GET /v1/messages never serves a note", () => {
	it("returns the visitor-visible roles only; note content absent", async () => {
		const res = await widgetMessages.request(
			"/messages?projectKey=pk_a&clientId=visitor-1",
			{},
			ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			messages: { id: string; role: string; content: string }[];
		};
		// Positive half of the assertion: system rows STAY on the feed — the
		// filter is VISITOR_VISIBLE_ROLES, not the narrower recap allowlist.
		expect(body.messages.map((m) => m.role)).toEqual([
			"user",
			"assistant",
			"admin",
			"system",
		]);
		expect(JSON.stringify(body)).not.toContain(NOTE_TOKEN);
		expect(JSON.stringify(body)).not.toContain("orphan note");
	});
});

describe("notes endpoint — POST /api/projects/:pid/conversations/:id/notes", () => {
	const url = `/projects/${pA}/conversations/${c1}/notes`;
	const post = (
		headers: Record<string, string>,
		content = "flagging for follow-up",
	) =>
		conversations.request(
			url,
			{
				method: "POST",
				headers: { ...headers, "content-type": "application/json" },
				body: JSON.stringify({ content }),
			},
			ENV,
		);

	it("agent-role member can write; 201; sequence + messageCount bump; NO email, analytics, or emailMessageId", async () => {
		const res = await post({ "x-test-user": u2, "x-workspace-id": wsA });
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			message: {
				id: string;
				role: string;
				sequence: number;
				authorUserId: string;
			};
		};
		expect(body.message.role).toBe("note");
		// messageCount(8)+1 — NOT MAX(sequence)(6)+1, which the fixture's gap
		// would expose as 7.
		expect(body.message.sequence).toBe(9);
		expect(body.message.authorUserId).toBe(u2);
		const conv = sqlite
			.prepare("SELECT message_count FROM conversation WHERE id = ?")
			.get(c1) as { message_count: number };
		expect(conv.message_count).toBe(9);
		// The created row carries NO email_message_id: a stamped RFC-5322 id
		// would let inbound-email threading (In-Reply-To matching) resolve a
		// reply against a note — the exact hazard the handler comment warns about.
		const row = sqlite
			.prepare("SELECT email_message_id AS emid FROM message WHERE id = ?")
			.get(body.message.id) as { emid: string | null };
		expect(row.emid).toBeNull();
		// The exclusion from email is structural: with a visitor email on file, a
		// note write must still never touch the email lib.
		sqlite
			.prepare("UPDATE conversation SET email = 'vic@example.com' WHERE id = ?")
			.run(c1);
		const res2 = await post({ "x-test-user": u2, "x-workspace-id": wsA });
		expect(res2.status).toBe(201);
		expect(sendEmail).not.toHaveBeenCalled();
		expect(sendEscalationSlack).not.toHaveBeenCalled();
		// No server-side analytics on the notes path either — the only note_added
		// event is the dashboard's client-side one (which carries no payload).
		expect(captureEvent).not.toHaveBeenCalled();
		expect(captureInBackground).not.toHaveBeenCalled();
	});

	it("unauthenticated → 401; foreign tenant → 404; non-member → 403", async () => {
		const unauthed = await post({ "x-workspace-id": wsA });
		expect(unauthed.status).toBe(401);
		// uB is a real member of wsB, but pA does not belong to wsB → 404.
		const foreign = await post({ "x-test-user": uB, "x-workspace-id": wsB });
		expect(foreign.status).toBe(404);
		// uB is not a member of wsA at all → the workspace gate rejects.
		const nonMember = await post({ "x-test-user": uB, "x-workspace-id": wsA });
		expect(nonMember.status).toBe(403);
		const rows = sqlite
			.prepare("SELECT COUNT(*) AS n FROM message WHERE role = 'note'")
			.get() as { n: number };
		expect(rows.n).toBe(2); // only the seeded notes — nothing was written
	});

	it("caps content at 10k on BOTH /notes and /reply", async () => {
		const big = "x".repeat(10_001);
		const noteRes = await post(MEMBER_HEADERS, big);
		expect(noteRes.status).toBe(400);
		const replyRes = await conversations.request(
			`/projects/${pA}/conversations/${c1}/reply`,
			{
				method: "POST",
				headers: { ...MEMBER_HEADERS, "content-type": "application/json" },
				body: JSON.stringify({ content: big }),
			},
			ENV,
		);
		expect(replyRes.status).toBe(400);
	});
});

describe("thread GET — notes ARE the operator surface, with authorName", () => {
	it("returns notes in sequence order with a joined authorName (null for deleted authors)", async () => {
		const res = await conversations.request(
			`/projects/${pA}/conversations/${c1}`,
			{ headers: MEMBER_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			messages: {
				id: string;
				role: string;
				authorName: string | null;
			}[];
		};
		const note = body.messages.find((m) => m.id === "m-note");
		expect(note?.role).toBe("note");
		expect(note?.authorName).toBe("Omar Owner");
		const orphan = body.messages.find((m) => m.id === "m-note-orphan");
		expect(orphan?.authorName).toBeNull();
		// Admin replies get the same attribution for free.
		const admin = body.messages.find((m) => m.id === "m-admin");
		expect(admin?.authorName).toBe("Omar Owner");
	});
});

describe("M5 — promote gate: only admin replies are promotable", () => {
	const promote = (messageId: string) =>
		sources.request(
			`/projects/${pA}/sources/promote`,
			{
				method: "POST",
				headers: { ...MEMBER_HEADERS, "content-type": "application/json" },
				body: JSON.stringify({ messageId }),
			},
			ENV,
		);

	it("a note id → 404, and no source row is created", async () => {
		const res = await promote("m-note");
		expect(res.status).toBe(404);
		const n = (
			sqlite.prepare("SELECT COUNT(*) AS n FROM source").get() as { n: number }
		).n;
		expect(n).toBe(0);
	});

	it("an admin reply still promotes (regression pair)", async () => {
		const res = await promote("m-admin");
		expect(res.status).toBe(200);
		const row = sqlite
			.prepare("SELECT kind, content FROM source LIMIT 1")
			.get() as { kind: string; content: string };
		expect(row.kind).toBe("qa");
		expect(row.content).toContain("refund approved");
	});
});

describe("operator search includes notes (positive hit)", () => {
	it("⌘K body-search surfaces the conversation via the note's content", async () => {
		const res = await search.request(
			`/search?q=${encodeURIComponent("SECRET-NOTE-TOKEN")}`,
			{ headers: MEMBER_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			conversations: { id: string; match: { snippet: string } }[];
		};
		expect(body.conversations.map((x) => x.id)).toContain(c1);
	});
});

describe("rating a note fails closed", () => {
	it("POST /v1/rating on a note id → 400 (assistant-only gate)", async () => {
		const res = await widgetRating.request(
			"/rating",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectKey: "pk_a",
					clientId: "visitor-1",
					conversationId: c1,
					messageId: "m-note",
					rating: "up",
				}),
			},
			ENV,
		);
		expect(res.status).toBe(400);
	});
});

describe("M3 — inbox triage summary never ingests a note", () => {
	it("the transcript handed to the summarizer lacks the note, keeps the conversation", async () => {
		await maybeSummarize(ENV as never, { id: c1, messageCount: 8 });
		expect(summarizeConversation).toHaveBeenCalledTimes(1);
		const transcript = vi.mocked(summarizeConversation).mock.calls[0]![1];
		expect(transcript).not.toContain(NOTE_TOKEN);
		expect(transcript).not.toContain("orphan note");
		expect(transcript).toContain("Where is my refund?");
		expect(transcript).toContain("refund approved");
	});
});

describe("V2/S2 — escalation: recap and operator email exclude notes", () => {
	it("the visitor recap transcript and the notification email both lack note content", async () => {
		vi.mocked(summarizeForVisitor).mockResolvedValueOnce("recap text");
		const { ctx, settle } = makeCtx();
		const res = await chat.request(
			"/escalate",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectKey: "pk_a",
					clientId: "visitor-1",
					messages: [],
				}),
			},
			ENV,
			ctx as never,
		);
		expect(res.status).toBe(200);
		// Visitor recap input (RECAP_ROLES): conversation only, no system, no notes.
		expect(summarizeForVisitor).toHaveBeenCalledTimes(1);
		const recapTranscript = vi.mocked(summarizeForVisitor).mock.calls[0]![1];
		expect(recapTranscript).not.toContain(NOTE_TOKEN);
		expect(recapTranscript).not.toContain("orphan note");
		expect(recapTranscript).not.toContain("System marker row");
		expect(recapTranscript).toContain("Where is my refund?");
		// Operator email (VISITOR_VISIBLE_ROLES): keeps the conversation + the
		// system marker, never a note.
		expect(sendEmail).toHaveBeenCalledTimes(1);
		const email = vi.mocked(sendEmail).mock.calls[0]![1] as { html: string };
		expect(email.html).not.toContain(NOTE_TOKEN);
		expect(email.html).not.toContain("orphan note");
		expect(email.html).toContain("refund approved");
		// System rows stay in the operator email (VISITOR_VISIBLE_ROLES ≠ RECAP_ROLES).
		expect(email.html).toContain("System marker row");
		await settle();
	});
});

describe("model input — a stored note never reaches the chat prompt (Phase-1 test 5)", () => {
	it("streamChat receives no note content anywhere, system prompt included; quoting a note id resolves to no quote", async () => {
		vi.mocked(streamChat).mockResolvedValue({
			text: Promise.resolve("hello"),
			usage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
			totalUsage: Promise.resolve({ inputTokens: 1, outputTokens: 2 }),
			toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
		} as never);
		const { ctx, settle } = makeCtx();
		const res = await chat.request(
			"/chat",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectKey: "pk_a",
					clientId: "visitor-1",
					// The visitor even tries to quote-reply the note id directly.
					replyToMessageId: "m-note",
					messages: [
						{ role: "user", parts: [{ type: "text", text: "and my order?" }] },
					],
				}),
			},
			ENV,
			ctx as never,
		);
		expect(res.status).toBe(200);
		expect(streamChat).toHaveBeenCalledTimes(1);
		const input = vi.mocked(streamChat).mock.calls[0]![1];
		// Nothing in the ENTIRE model input — system prompt, sources, quote,
		// messages — carries the note.
		expect(JSON.stringify(input)).not.toContain(NOTE_TOKEN);
		expect(JSON.stringify(input)).not.toContain("orphan note");
		// The quote reference silently resolved to nothing (allowlist fail-closed).
		expect((input as { quote?: unknown }).quote).toBeUndefined();
		await settle();
	});
});

describe("notifications bell ignores notes", () => {
	it("the feed carries no note content (role='user' allowlist holds)", async () => {
		const res = await notifications.request(
			"/notifications",
			{ headers: MEMBER_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(JSON.stringify(await res.json())).not.toContain(NOTE_TOKEN);
	});
});
