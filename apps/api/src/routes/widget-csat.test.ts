import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { widgetCsat } from "./widget-csat";

// Faithful in-memory fake: findFirst evaluates the route's real where-callbacks
// against seeded rows, so cross-tenant rejections are actually exercised. The
// single conversation update is matched by id.
vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@llmchat/db", async (orig) => ({
	...(await orig<typeof import("@llmchat/db")>()),
	eq: (_col: unknown, val: unknown) => ({ eqVal: val }),
}));

type Row = Record<string, unknown>;

function fakeDb(data: { projects: Row[]; conversations: Row[] }) {
	const ops = {
		eq: (col: string, val: unknown) => (row: Row) => row[col] === val,
		and:
			(...preds: ((r: Row) => boolean)[]) =>
			(row: Row) =>
				preds.every((p) => p(row)),
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
		},
		update: () => ({
			set: (vals: Row) => ({
				where: async (cond: { eqVal?: unknown }) => {
					const target = data.conversations.find((cv) => cv.id === cond.eqVal);
					if (target) Object.assign(target, vals);
					return [];
				},
			}),
		}),
	};
}

/** Two tenants: project p1/client1 owns conversation c1; p2/client2 owns c2. */
function seed() {
	const data: { projects: Row[]; conversations: Row[] } = {
		projects: [
			{ id: "p1", publicKey: "pk1" },
			{ id: "p2", publicKey: "pk2" },
		],
		conversations: [
			{ id: "c1", projectId: "p1", clientId: "client1", csatRating: null },
			{ id: "c2", projectId: "p2", clientId: "client2", csatRating: null },
		],
	};
	vi.mocked(db).mockReturnValue(
		fakeDb(data) as unknown as ReturnType<typeof db>,
	);
	return data;
}

const ENV = { vars: {}, DB: {} } as never;

function csat(body: unknown) {
	return widgetCsat.request(
		"/csat",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		ENV,
	);
}

const own = { projectKey: "pk1", clientId: "client1", conversationId: "c1" };

beforeEach(() => vi.clearAllMocks());

describe("POST /v1/csat", () => {
	it("persists a 1–5 rating on the caller's own conversation", async () => {
		const data = seed();
		const res = await csat({ ...own, rating: 4 });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(data.conversations.find((c) => c.id === "c1")?.csatRating).toBe(4);
	});

	it("accepts the boundary values 1 and 5", async () => {
		const data = seed();
		expect((await csat({ ...own, rating: 1 })).status).toBe(200);
		expect(data.conversations[0].csatRating).toBe(1);
		expect((await csat({ ...own, rating: 5 })).status).toBe(200);
		expect(data.conversations[0].csatRating).toBe(5);
	});

	it("clears the rating with null", async () => {
		const data = seed();
		data.conversations[0].csatRating = 3;
		const res = await csat({ ...own, rating: null });
		expect(res.status).toBe(200);
		expect(data.conversations[0].csatRating).toBeNull();
	});

	it("rejects rating another tenant's conversation", async () => {
		const data = seed();
		// project 1 caller targeting project 2's conversation
		const res = await csat({
			projectKey: "pk1",
			clientId: "client1",
			conversationId: "c2",
			rating: 5,
		});
		expect(res.status).toBe(404);
		expect(
			data.conversations.find((c) => c.id === "c2")?.csatRating,
		).toBeNull();
	});

	it("rejects a clientId that doesn't own the conversation", async () => {
		seed();
		const res = await csat({ ...own, clientId: "intruder", rating: 3 });
		expect(res.status).toBe(404);
	});

	it("rejects an invalid project key", async () => {
		seed();
		expect((await csat({ ...own, projectKey: "nope", rating: 3 })).status).toBe(
			404,
		);
	});

	it("rejects out-of-range ratings (0 and 6)", async () => {
		seed();
		expect((await csat({ ...own, rating: 0 })).status).toBe(400);
		expect((await csat({ ...own, rating: 6 })).status).toBe(400);
	});

	it("rejects a non-integer rating", async () => {
		seed();
		expect((await csat({ ...own, rating: 3.5 })).status).toBe(400);
	});

	it("rejects a missing rating field", async () => {
		seed();
		const res = await csat({
			projectKey: "pk1",
			clientId: "client1",
			conversationId: "c1",
		});
		expect(res.status).toBe(400);
	});
});
