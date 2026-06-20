import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { conversation, message, readStatus } from "@llmchat/db";

import { conversations } from "./conversations";

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
}

/** Records the shape of every message-table query so tests can assert the
 * content-search queries are scoped via a conversation join. */
let messageQueries: { distinct: boolean; joined: boolean }[];

function mockDb(state: State) {
	messageQueries = [];

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
			where() {
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
		},
		select: () => builder(false),
		selectDistinct: () => builder(true),
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
