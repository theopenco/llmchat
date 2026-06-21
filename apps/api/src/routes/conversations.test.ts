import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { db } from "@/lib/db";

import {
	conversation,
	conversationTag,
	message,
	readStatus,
	tag as tagTable,
} from "@llmchat/db";

import { conversations } from "./conversations";

// Render a captured drizzle WHERE to SQL text so tests can assert on the actual
// generated predicate (active vs archived, project scoping) rather than trusting
// the fake db to evaluate it.
const dialect = new SQLiteSyncDialect({ casing: "snake_case" });
function whereSql(): string {
	if (!lastConversationWhere) return "";
	return dialect.sqlToQuery(lastConversationWhere).sql.toLowerCase();
}

// Header-driven fake session (same pattern as projects.test): `x-test-user`
// present ⇒ signed in; `query.member.findFirst` decides workspace membership.
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

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof conversations.request
>[2];

type Row = Record<string, unknown>;

interface State {
	role?: "owner" | "admin" | "agent";
	/** The project as seen by the workspace-scoped ownership check (undefined ⇒
	 * 404, i.e. not in the caller's workspace). */
	project?: Row;
	/** Project-scoped conversation rows the main list query returns. */
	conversationRows?: Row[];
	/** Conversation ids whose message bodies match (membership query result). */
	bodyMatchIds?: string[];
	/** Matching message bodies for the snippet query, in sequence order. */
	snippetRows?: { conversationId: string; content: string }[];
	/** Sequence-1 previews for the firstMessage query. */
	firstMessages?: { conversationId: string; content: string }[];
	/** The conversation the thread endpoint resolves (undefined ⇒ 404). */
	conv?: Row;
	/** Rows the thread message window query returns (relational findMany). */
	threadMessages?: Row[];
	/** Batched per-page tag rows (conversation_tag ⨝ tag) for the list response. */
	tagRows?: {
		conversationId: string;
		id: string;
		name: string;
		color: string | null;
	}[];
	/** A tag resolved by id on attach (undefined ⇒ 404, e.g. foreign workspace). */
	tag?: Row;
	/** Existing (conversation,tag) association for the idempotency check. */
	existingAssoc?: Row;
	/** Tag lookup result for findOrCreateTag's dedupe select (attach-by-name). */
	tagLookup?: Row[];
}

/** How many times the batched per-page tag query (conversation_tag) ran — used
 * to assert the list attaches tags in ONE query (no N+1). */
let conversationTagSelects: number;
let insertSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;

/** Records the shape of every message-table query so tests can assert the
 * content-search queries are scoped via a conversation join. */
let messageQueries: { distinct: boolean; joined: boolean }[];
/** The WHERE passed to the main conversation list query, for SQL inspection. */
let lastConversationWhere: Parameters<typeof dialect.sqlToQuery>[0] | null;

function mockDb(state: State) {
	messageQueries = [];
	lastConversationWhere = null;
	conversationTagSelects = 0;
	insertSpy = vi.fn(() => ({
		values: (data: Record<string, unknown>) => {
			const result = [{ id: "row_new", ...data }];
			const ret = { returning: async () => result };
			// `.values()` is awaited directly for join inserts and `.returning()`ed
			// for tag inserts, so it must be both thenable and expose returning.
			return Object.assign(Promise.resolve(result), ret);
		},
	}));
	deleteSpy = vi.fn(() => ({ where: async () => [] }));

	function builder(distinct: boolean) {
		const q = { table: null as unknown, joined: false };
		const resolve = (): unknown[] => {
			if (q.table === message) {
				messageQueries.push({ distinct, joined: q.joined });
				if (q.joined) {
					return distinct
						? (state.bodyMatchIds ?? []).map((id) => ({ id }))
						: (state.snippetRows ?? []);
				}
				return state.firstMessages ?? [];
			}
			if (q.table === conversation) return state.conversationRows ?? [];
			if (q.table === conversationTag) {
				// The batched per-page tag join (list response).
				conversationTagSelects += 1;
				return state.tagRows ?? [];
			}
			if (q.table === tagTable) return state.tagLookup ?? [];
			if (q.table === readStatus) return [];
			return [];
		};
		const chain: Record<string, unknown> = {
			from(t: unknown) {
				q.table = t;
				return chain;
			},
			innerJoin() {
				q.joined = true;
				return chain;
			},
			where(cond: unknown) {
				if (q.table === conversation) {
					lastConversationWhere = cond as Parameters<
						typeof dialect.sqlToQuery
					>[0];
				}
				return chain;
			},
			orderBy() {
				return chain;
			},
			limit() {
				return chain;
			},
			offset() {
				return chain;
			},
			// The fake query builder is intentionally awaitable (the route awaits the
			// chain), so it must expose `then`.
			// eslint-disable-next-line unicorn/no-thenable
			then<R>(onF: (v: unknown[]) => R) {
				return Promise.resolve(resolve()).then(onF);
			},
		};
		return chain;
	}

	const fake = {
		query: {
			member: {
				findFirst: async () => (state.role ? { role: state.role } : undefined),
			},
			project: {
				findFirst: async () => state.project,
			},
			conversation: {
				findFirst: async () => state.conv,
			},
			message: {
				findMany: async () => state.threadMessages ?? [],
			},
			tag: {
				findFirst: async () => state.tag,
			},
			conversationTag: {
				findFirst: async () => state.existingAssoc,
			},
		},
		select: () => builder(false),
		selectDistinct: () => builder(true),
		insert: insertSpy,
		delete: deleteSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
}

function get(path: string, headers: Record<string, string>) {
	return conversations.request(path, { method: "GET", headers }, ENV);
}

const MEMBER = { "x-test-user": "u1", "x-workspace-id": "ws_1" };
const PROJECT = { id: "p1", workspaceId: "ws_1" };

beforeEach(() => vi.clearAllMocks());

describe("inbox search — role gating", () => {
	it("401s an unauthenticated request", async () => {
		mockDb({});
		const res = await get("/projects/p1/conversations?search=hi", {
			"x-workspace-id": "ws_1",
		});
		expect(res.status).toBe(401);
	});

	it("403s a non-member (no membership in the workspace)", async () => {
		mockDb({}); // no role ⇒ not a member
		const res = await get("/projects/p1/conversations?search=hi", MEMBER);
		expect(res.status).toBe(403);
	});

	it("lets any member (agent) search", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const res = await get("/projects/p1/conversations?search=hi", MEMBER);
		expect(res.status).toBe(200);
	});
});

describe("inbox search — scoping", () => {
	it("404s when the project isn't in the caller's workspace (can't search foreign data)", async () => {
		mockDb({ role: "owner", project: undefined });
		const res = await get("/projects/pX/conversations?search=secret", MEMBER);
		expect(res.status).toBe(404);
	});

	it("scopes message matching via a conversation join — never an unscoped scan", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cA", name: "Bob", email: null, messageCount: 2 },
			],
			bodyMatchIds: ["cA"],
			snippetRows: [{ conversationId: "cA", content: "the refund policy" }],
		});
		const res = await get("/projects/p1/conversations?search=refund", MEMBER);
		expect(res.status).toBe(200);
		// Both content-search queries (membership + snippet) ran joined to
		// conversation; none scanned messages unscoped.
		const contentQueries = messageQueries.filter(
			(m) => m.distinct || (!m.distinct && m.joined),
		);
		expect(messageQueries.some((m) => m.distinct && m.joined)).toBe(true);
		expect(contentQueries.every((m) => m.joined)).toBe(true);
	});
});

describe("inbox search — matching", () => {
	it("matches message body text and returns a highlighted-able snippet", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cA", name: "Bob", email: null, messageCount: 2 },
			],
			bodyMatchIds: ["cA"],
			snippetRows: [
				{
					conversationId: "cA",
					content:
						"Sure — our refund policy is a full 30 days for any unused order.",
				},
			],
		});
		const res = await get("/projects/p1/conversations?search=refund", MEMBER);
		const body = (await res.json()) as {
			conversations: {
				id: string;
				match: { field: string; snippet: string };
			}[];
		};
		expect(body.conversations).toHaveLength(1);
		expect(body.conversations[0]!.match.field).toBe("body");
		expect(body.conversations[0]!.match.snippet.toLowerCase()).toContain(
			"refund",
		);
	});

	it("still matches visitor name", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cN", name: "Ada Lovelace", email: "ada@x.io", messageCount: 1 },
			],
		});
		const res = await get("/projects/p1/conversations?search=lovelace", MEMBER);
		const body = (await res.json()) as {
			conversations: { match: { field: string; snippet: string } }[];
		};
		expect(body.conversations[0]!.match).toEqual({
			field: "name",
			snippet: "Ada Lovelace",
		});
	});

	it("still matches visitor email", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cE", name: "Ada", email: "ada@example.io", messageCount: 1 },
			],
		});
		const res = await get(
			"/projects/p1/conversations?search=example.io",
			MEMBER,
		);
		const body = (await res.json()) as {
			conversations: { match: { field: string } }[];
		};
		expect(body.conversations[0]!.match.field).toBe("email");
	});

	it("returns an empty list when nothing matches", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [],
			bodyMatchIds: [],
		});
		const res = await get("/projects/p1/conversations?search=zzzznope", MEMBER);
		const body = (await res.json()) as { conversations: unknown[] };
		expect(body.conversations).toEqual([]);
	});

	it("omits match (null) and keeps the firstMessage preview when not searching", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cA", name: "Bob", email: null, messageCount: 1 },
			],
			firstMessages: [{ conversationId: "cA", content: "hello there" }],
		});
		const res = await get("/projects/p1/conversations", MEMBER);
		const body = (await res.json()) as {
			conversations: { match: unknown; firstMessage: string }[];
		};
		expect(body.conversations[0]!.match).toBeNull();
		expect(body.conversations[0]!.firstMessage).toBe("hello there");
	});
});

describe("inbox archived filter", () => {
	it("defaults to the active view — WHERE keeps only non-archived rows, scoped to the project", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const res = await get("/projects/p1/conversations", MEMBER);
		expect(res.status).toBe(200);
		const sql = whereSql();
		expect(sql).toContain('"archived_at" is null');
		expect(sql).not.toContain("is not null");
		// Always project-scoped (no cross-workspace leak).
		expect(sql).toContain('"project_id"');
	});

	it("archived=true returns only archived rows (archived_at is not null)", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const res = await get("/projects/p1/conversations?archived=true", MEMBER);
		expect(res.status).toBe(200);
		const sql = whereSql();
		expect(sql).toContain('"archived_at" is not null');
	});

	it("archived=false is treated as the active view", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		await get("/projects/p1/conversations?archived=false", MEMBER);
		const sql = whereSql();
		expect(sql).toContain('"archived_at" is null');
		expect(sql).not.toContain("is not null");
	});

	it("composes with search — archived view AND a text match in the same WHERE", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [],
			bodyMatchIds: ["cZ"],
		});
		await get("/projects/p1/conversations?archived=true&search=refund", MEMBER);
		const sql = whereSql();
		// The archived predicate and the search OR-group coexist, project-scoped.
		expect(sql).toContain('"archived_at" is not null');
		expect(sql).toContain("like");
		expect(sql).toContain('"project_id"');
	});

	it("is role-gated: a non-member can't list archived (403, no query)", async () => {
		mockDb({}); // not a member
		const res = await get("/projects/p1/conversations?archived=true", MEMBER);
		expect(res.status).toBe(403);
		expect(lastConversationWhere).toBeNull();
	});
});

describe("inbox keyset pagination", () => {
	// A conversation row shaped for the list query: the route reads updatedAt as a
	// Date to mint the next cursor, plus id/messageCount for the row payload.
	function row(id: string, updatedAtSec: number): Record<string, unknown> {
		return {
			id,
			name: null,
			email: null,
			messageCount: 1,
			updatedAt: new Date(updatedAtSec * 1000),
		};
	}

	it("returns nextCursor only when another page exists (limit+1 overflow)", async () => {
		// limit=2 but 3 rows come back ⇒ there IS a next page.
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [row("cA", 300), row("cB", 200), row("cC", 100)],
		});
		const res = await get("/projects/p1/conversations?limit=2", MEMBER);
		const body = (await res.json()) as {
			conversations: { id: string }[];
			nextCursor: string | null;
		};
		// Only `limit` rows are returned; the sentinel row is dropped.
		expect(body.conversations.map((c) => c.id)).toEqual(["cA", "cB"]);
		// The cursor points at the LAST returned row (cB), so the next page resumes
		// after it.
		expect(decodeCursor(body.nextCursor ?? undefined)).toEqual({
			updatedAt: 200,
			id: "cB",
		});
	});

	it("returns nextCursor null on the last page (no overflow)", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [row("cA", 300), row("cB", 200)],
		});
		const res = await get("/projects/p1/conversations?limit=2", MEMBER);
		const body = (await res.json()) as { nextCursor: string | null };
		expect(body.nextCursor).toBeNull();
	});

	it("a cursor adds the keyset predicate, still project-scoped", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const cursor = encodeCursor({ updatedAt: 250, id: "cMid" });
		await get(`/projects/p1/conversations?cursor=${cursor}`, MEMBER);
		const sql = whereSql();
		// Keyset on (updatedAt desc, id desc): resume strictly after the cursor.
		expect(sql).toContain('"updated_at" <');
		expect(sql).toContain('"id" <');
		// Never drops the project scope.
		expect(sql).toContain('"project_id"');
	});

	it("search spans pages: the search OR-group AND the keyset predicate coexist", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [],
			bodyMatchIds: ["cZ"],
		});
		const cursor = encodeCursor({ updatedAt: 250, id: "cMid" });
		await get(
			`/projects/p1/conversations?search=refund&cursor=${cursor}`,
			MEMBER,
		);
		const sql = whereSql();
		// The matched set is pre-resolved (LIKE) AND paging continues within it.
		expect(sql).toContain("like");
		expect(sql).toContain('"updated_at" <');
		expect(sql).toContain('"project_id"');
	});

	it("archived filter composes with the cursor", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const cursor = encodeCursor({ updatedAt: 250, id: "cMid" });
		await get(
			`/projects/p1/conversations?archived=true&cursor=${cursor}`,
			MEMBER,
		);
		const sql = whereSql();
		expect(sql).toContain('"archived_at" is not null');
		expect(sql).toContain('"updated_at" <');
	});

	it("a garbage cursor is ignored (serves page 1, no keyset predicate, no error)", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		const res = await get(
			"/projects/p1/conversations?cursor=!!!garbage!!!",
			MEMBER,
		);
		expect(res.status).toBe(200);
		expect(whereSql()).not.toContain('"updated_at" <');
	});
});

describe("inbox stats aggregate", () => {
	it("returns true project-wide totals (not loaded-page counts)", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			// The fake select() returns this verbatim as the single aggregate row.
			conversationRows: [
				{ total: 4210, escalated: 37, resolved: 1200, avgRating: 4.3 },
			],
		});
		const res = await get("/projects/p1/conversations/stats", MEMBER);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({
			total: 4210,
			escalated: 37,
			resolved: 1200,
			avgRating: 4.3,
		});
	});

	it("404s when the project isn't in the caller's workspace", async () => {
		mockDb({ role: "owner", project: undefined });
		const res = await get("/projects/pX/conversations/stats", MEMBER);
		expect(res.status).toBe(404);
	});

	it("403s a non-member", async () => {
		mockDb({});
		const res = await get("/projects/p1/conversations/stats", MEMBER);
		expect(res.status).toBe(403);
	});
});

describe("thread pagination (GET conversations/:id)", () => {
	const CONV = { id: "cThread", projectId: "p1" };

	it("latest page: returns ascending messages + hasOlder via the limit+1 sentinel", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			// Server fetches newest-first limit+1; with limit=2 these 3 rows ⇒ older
			// history exists.
			threadMessages: [
				{ id: "m3", sequence: 3 },
				{ id: "m2", sequence: 2 },
				{ id: "m1", sequence: 1 },
			],
		});
		const res = await get("/projects/p1/conversations/cThread?limit=2", MEMBER);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			messages: { sequence: number }[];
			hasOlder: boolean;
			firstHitSequence: number | null;
		};
		// `limit` rows, re-sorted ascending (oldest→newest).
		expect(body.messages.map((m) => m.sequence)).toEqual([2, 3]);
		expect(body.hasOlder).toBe(true);
		expect(body.firstHitSequence).toBeNull();
	});

	it("after=<seq> (poll) never reports hasOlder — newest-only, no sentinel", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			threadMessages: [{ id: "m9", sequence: 9 }],
		});
		const res = await get("/projects/p1/conversations/cThread?after=8", MEMBER);
		const body = (await res.json()) as {
			messages: { sequence: number }[];
			hasOlder: boolean;
		};
		expect(body.messages.map((m) => m.sequence)).toEqual([9]);
		expect(body.hasOlder).toBe(false);
	});

	it("search reports the first hit's sequence so the client can page to it", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			threadMessages: [{ id: "m20", sequence: 20 }],
			// The firstHit lookup (core select) resolves to this.
			firstMessages: [
				{ sequence: 7 } as unknown as {
					conversationId: string;
					content: string;
				},
			],
		});
		const res = await get(
			"/projects/p1/conversations/cThread?search=refund",
			MEMBER,
		);
		const body = (await res.json()) as { firstHitSequence: number | null };
		expect(body.firstHitSequence).toBe(7);
	});

	it("404s when the project isn't in the caller's workspace", async () => {
		mockDb({ role: "owner", project: undefined });
		const res = await get("/projects/pX/conversations/cThread", MEMBER);
		expect(res.status).toBe(404);
	});

	it("404s when the conversation doesn't exist in the project", async () => {
		mockDb({ role: "agent", project: PROJECT, conv: undefined });
		const res = await get("/projects/p1/conversations/nope", MEMBER);
		expect(res.status).toBe(404);
	});

	it("403s a non-member (no query runs)", async () => {
		mockDb({});
		const res = await get("/projects/p1/conversations/cThread", MEMBER);
		expect(res.status).toBe(403);
	});
});

const JSONH = { "content-type": "application/json" };
function send(
	path: string,
	method: string,
	body?: unknown,
	headers: Record<string, string> = MEMBER,
) {
	return conversations.request(
		path,
		{
			method,
			headers: body ? { ...headers, ...JSONH } : headers,
			body: body ? JSON.stringify(body) : undefined,
		},
		ENV,
	);
}

describe("inbox tag filter (tagIds)", () => {
	it("adds an OR subquery on conversation_tag, still project-scoped", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		await get("/projects/p1/conversations?tagIds=t1,t2", MEMBER);
		const sql = whereSql();
		expect(sql).toContain("conversation_tag");
		expect(sql).toContain("in (select");
		expect(sql).toContain('"project_id"');
	});

	it("composes with archived + search + cursor in one WHERE", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [],
			bodyMatchIds: ["cZ"],
		});
		const cursor = encodeCursor({ updatedAt: 250, id: "cMid" });
		await get(
			`/projects/p1/conversations?tagIds=t1&archived=true&search=refund&cursor=${cursor}`,
			MEMBER,
		);
		const sql = whereSql();
		expect(sql).toContain("conversation_tag"); // tag filter
		expect(sql).toContain('"archived_at" is not null'); // archived
		expect(sql).toContain("like"); // search
		expect(sql).toContain('"updated_at" <'); // keyset cursor
	});

	it("empty/whitespace tagIds adds NO tag predicate", async () => {
		mockDb({ role: "agent", project: PROJECT, conversationRows: [] });
		await get("/projects/p1/conversations?tagIds=%20%20", MEMBER);
		expect(whereSql()).not.toContain("conversation_tag");
	});
});

describe("inbox list — tags attached per page (no N+1)", () => {
	it("attaches each conversation's tags in ONE batched query", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cA", name: "Bob", email: null, messageCount: 1 },
				{ id: "cB", name: "Ada", email: null, messageCount: 1 },
			],
			tagRows: [
				{ conversationId: "cA", id: "t1", name: "Billing", color: "#6366f1" },
				{ conversationId: "cA", id: "t2", name: "VIP", color: "#ef4444" },
				{ conversationId: "cB", id: "t1", name: "Billing", color: "#6366f1" },
			],
		});
		const res = await get("/projects/p1/conversations", MEMBER);
		const body = (await res.json()) as {
			conversations: { id: string; tags: { id: string; name: string }[] }[];
		};
		expect(body.conversations[0]!.tags.map((t) => t.id)).toEqual(["t1", "t2"]);
		expect(body.conversations[1]!.tags.map((t) => t.name)).toEqual(["Billing"]);
		// Exactly one conversation_tag query for the whole page — not one per row.
		expect(conversationTagSelects).toBe(1);
	});

	it("returns an empty tags array when a conversation has none", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conversationRows: [
				{ id: "cA", name: "Bob", email: null, messageCount: 1 },
			],
			tagRows: [],
		});
		const res = await get("/projects/p1/conversations", MEMBER);
		const body = (await res.json()) as { conversations: { tags: unknown[] }[] };
		expect(body.conversations[0]!.tags).toEqual([]);
	});
});

describe("attach tag — POST conversations/:id/tags", () => {
	const CONV = { id: "c1", projectId: "p1" };

	it("attaches an existing workspace tag by id (idempotent: inserts once)", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			tag: { id: "t1", name: "Billing", color: "#6366f1", workspaceId: "ws_1" },
			existingAssoc: undefined,
		});
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {
			tagId: "t1",
		});
		expect(res.status).toBe(200);
		expect((await res.json()) as unknown).toMatchObject({
			tag: { id: "t1", name: "Billing" },
		});
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("is idempotent: an existing association is not re-inserted", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			tag: { id: "t1", name: "Billing", color: null, workspaceId: "ws_1" },
			existingAssoc: { id: "a1", conversationId: "c1", tagId: "t1" },
		});
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {
			tagId: "t1",
		});
		expect(res.status).toBe(200);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s a tag from another workspace; never inserts (no cross-workspace attach)", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			tag: undefined, // the workspace-scoped tag lookup finds nothing
		});
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {
			tagId: "foreign",
		});
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s when the project isn't in the caller's workspace", async () => {
		mockDb({ role: "owner", project: undefined });
		const res = await send("/projects/pX/conversations/c1/tags", "POST", {
			tagId: "t1",
		});
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s when the conversation isn't in the project", async () => {
		mockDb({ role: "agent", project: PROJECT, conv: undefined });
		const res = await send("/projects/p1/conversations/nope/tags", "POST", {
			tagId: "t1",
		});
		expect(res.status).toBe(404);
	});

	it("create-and-attach by name (no existing tag) mints the tag then associates", async () => {
		mockDb({
			role: "agent",
			project: PROJECT,
			conv: CONV,
			tagLookup: [], // findOrCreateTag finds no existing → creates
			existingAssoc: undefined,
		});
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {
			name: "Refunds",
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { tag: { name: string } };
		expect(body.tag.name).toBe("Refunds");
		// One insert for the tag + one for the association.
		expect(insertSpy).toHaveBeenCalledTimes(2);
	});

	it("400s when neither tagId nor name is provided", async () => {
		mockDb({ role: "agent", project: PROJECT, conv: CONV });
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {});
		expect(res.status).toBe(400);
	});

	it("403s a non-member", async () => {
		mockDb({});
		const res = await send("/projects/p1/conversations/c1/tags", "POST", {
			tagId: "t1",
		});
		expect(res.status).toBe(403);
	});
});

describe("detach tag — DELETE conversations/:id/tags/:tagId", () => {
	const CONV = { id: "c1", projectId: "p1" };

	it("detaches and is no-op-safe when not attached", async () => {
		mockDb({ role: "agent", project: PROJECT, conv: CONV });
		const res = await send("/projects/p1/conversations/c1/tags/t1", "DELETE");
		expect(res.status).toBe(200);
		expect(deleteSpy).toHaveBeenCalledTimes(1);
	});

	it("404s when the project isn't in the caller's workspace; never deletes", async () => {
		mockDb({ role: "owner", project: undefined });
		const res = await send("/projects/pX/conversations/c1/tags/t1", "DELETE");
		expect(res.status).toBe(404);
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("403s a non-member; never deletes", async () => {
		mockDb({});
		const res = await send("/projects/p1/conversations/c1/tags/t1", "DELETE");
		expect(res.status).toBe(403);
		expect(deleteSpy).not.toHaveBeenCalled();
	});
});
