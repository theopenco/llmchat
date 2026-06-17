import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { widgetRating } from "./widget-rating";

// A faithful in-memory fake: relational findFirst evaluates the route's real
// where-callbacks against seeded rows, so cross-tenant rejections are actually
// exercised (not stubbed). The single rating update is matched by message id.
vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@llmchat/db", async (orig) => ({
	...(await orig<typeof import("@llmchat/db")>()),
	// Capture the target id so the fake update can locate the row.
	eq: (_col: unknown, val: unknown) => ({ eqVal: val }),
}));

type Row = Record<string, unknown>;

function fakeDb(data: {
	projects: Row[];
	conversations: Row[];
	messages: Row[];
}) {
	const ops = {
		eq: (col: string, val: unknown) => (row: Row) => row[col] === val,
		and:
			(...preds: ((r: Row) => boolean)[]) =>
			(row: Row) =>
				preds.every((p) => p(row)),
		or:
			(...preds: ((r: Row) => boolean)[]) =>
			(row: Row) =>
				preds.some((p) => p(row)),
	};
	const tableProxy = new Proxy(
		{},
		{ get: (_t, prop) => prop },
	) as unknown as Row;
	const findFirst =
		(rows: Row[]) =>
		async ({
			where,
		}: {
			where?: (t: Row, o: typeof ops) => (r: Row) => boolean;
		}) =>
			where ? rows.find(where(tableProxy, ops)) : rows[0];
	return {
		query: {
			project: { findFirst: findFirst(data.projects) },
			conversation: { findFirst: findFirst(data.conversations) },
			message: { findFirst: findFirst(data.messages) },
		},
		update: () => ({
			set: (vals: Row) => ({
				where: async (cond: { eqVal?: unknown }) => {
					const target = data.messages.find((m) => m.id === cond.eqVal);
					if (target) Object.assign(target, vals);
					return [];
				},
			}),
		}),
	};
}

/** Two tenants: project p1/client1 owns conversation c1 (assistant ma, user
 * mu); project p2/client2 owns conversation c2 (assistant mb). */
function seed() {
	const data = {
		projects: [
			{ id: "p1", publicKey: "pk1" },
			{ id: "p2", publicKey: "pk2" },
		],
		conversations: [
			{ id: "c1", projectId: "p1", clientId: "client1" },
			{ id: "c2", projectId: "p2", clientId: "client2" },
		],
		messages: [
			{ id: "mu", conversationId: "c1", role: "user", rating: null },
			{ id: "ma", conversationId: "c1", role: "assistant", rating: null },
			{ id: "mb", conversationId: "c2", role: "assistant", rating: null },
		],
	};
	vi.mocked(db).mockReturnValue(
		fakeDb(data) as unknown as ReturnType<typeof db>,
	);
	return data;
}

const ENV = { vars: {}, DB: {} } as never;

function rate(body: unknown) {
	return widgetRating.request(
		"/rating",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
	);
}

const own = {
	projectKey: "pk1",
	clientId: "client1",
	conversationId: "c1",
	messageId: "ma",
};

beforeEach(() => vi.clearAllMocks());

describe("POST /v1/rating", () => {
	it("persists a rating on the caller's own assistant message", async () => {
		const data = seed();
		const res = await rate({ ...own, rating: "up" });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(data.messages.find((m) => m.id === "ma")?.rating).toBe("up");
	});

	it("toggles up → down → clear (last-write-wins)", async () => {
		const data = seed();
		const ma = () => data.messages.find((m) => m.id === "ma");
		expect((await rate({ ...own, rating: "up" })).status).toBe(200);
		expect(ma()?.rating).toBe("up");
		expect((await rate({ ...own, rating: "down" })).status).toBe(200);
		expect(ma()?.rating).toBe("down");
		expect((await rate({ ...own, rating: null })).status).toBe(200);
		expect(ma()?.rating).toBeNull();
	});

	it("rejects rating another project's message (wrong clientId)", async () => {
		const data = seed();
		// Caller from project 1 trying to rate project 2's conversation/message.
		const res = await rate({
			projectKey: "pk1",
			clientId: "client1",
			conversationId: "c2",
			messageId: "mb",
			rating: "up",
		});
		expect(res.status).toBe(404);
		expect(data.messages.find((m) => m.id === "mb")?.rating).toBeNull();
	});

	it("rejects a clientId that doesn't own the conversation", async () => {
		seed();
		const res = await rate({ ...own, clientId: "intruder", rating: "up" });
		expect(res.status).toBe(404);
	});

	it("rejects a message that isn't in the named conversation", async () => {
		seed();
		// mb belongs to c2, not c1 — message lookup must fail.
		const res = await rate({ ...own, messageId: "mb", rating: "up" });
		expect(res.status).toBe(404);
	});

	it("rejects rating a non-assistant message", async () => {
		const data = seed();
		const res = await rate({ ...own, messageId: "mu", rating: "up" });
		expect(res.status).toBe(400);
		expect(data.messages.find((m) => m.id === "mu")?.rating).toBeNull();
	});

	it("rejects an invalid project key", async () => {
		seed();
		const res = await rate({ ...own, projectKey: "nope", rating: "up" });
		expect(res.status).toBe(404);
	});

	it("rejects a malformed body (missing rating)", async () => {
		seed();
		const res = await rate({
			projectKey: "pk1",
			clientId: "client1",
			conversationId: "c1",
			messageId: "ma",
		});
		expect(res.status).toBe(400);
	});

	it("rejects an out-of-range rating value", async () => {
		seed();
		const res = await rate({ ...own, rating: "sideways" });
		expect(res.status).toBe(400);
	});
});
