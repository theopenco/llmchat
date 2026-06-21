import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { tags } from "./tags";

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
	typeof tags.request
>[2];

interface State {
	role?: "owner" | "admin" | "agent";
	/** Result of the select chain (GET list, or the POST dedupe lookup). */
	selectResult?: Record<string, unknown>[];
}

let insertSpy: ReturnType<typeof vi.fn>;
let lastInsert: Record<string, unknown> | null;

function mockDb(state: State) {
	lastInsert = null;
	insertSpy = vi.fn(() => ({
		values: (data: Record<string, unknown>) => {
			lastInsert = data;
			return { returning: async () => [{ id: "tag_new", ...data }] };
		},
	}));
	const selectChain: Record<string, unknown> = {
		from: () => selectChain,
		leftJoin: () => selectChain,
		where: () => selectChain,
		groupBy: () => selectChain,
		orderBy: () => selectChain,
		limit: () => selectChain,
		// eslint-disable-next-line unicorn/no-thenable
		then: <R>(onF: (v: unknown[]) => R) =>
			Promise.resolve(state.selectResult ?? []).then(onF),
	};
	const fake = {
		query: {
			member: {
				findFirst: async () => (state.role ? { role: state.role } : undefined),
			},
		},
		select: () => selectChain,
		insert: insertSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
}

const json = { "content-type": "application/json" };
const MEMBER = { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json };

function post(body: unknown, headers: Record<string, string> = MEMBER) {
	return tags.request(
		"/tags",
		{ method: "POST", headers, body: JSON.stringify(body) },
		ENV,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /tags", () => {
	it("lists workspace tags with a conversation count", async () => {
		mockDb({
			role: "agent",
			selectResult: [
				{
					id: "t1",
					workspaceId: "ws_1",
					name: "Billing",
					color: "#6366f1",
					count: 12,
				},
				{
					id: "t2",
					workspaceId: "ws_1",
					name: "Bug",
					color: "#ef4444",
					count: 0,
				},
			],
		});
		const res = await tags.request(
			"/tags",
			{ method: "GET", headers: MEMBER },
			ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			tags: { name: string; count: number }[];
		};
		expect(body.tags).toHaveLength(2);
		expect(body.tags[0]).toMatchObject({ name: "Billing", count: 12 });
	});

	it("403s a non-member; 401s the signed-out", async () => {
		mockDb({});
		expect(
			(await tags.request("/tags", { method: "GET", headers: MEMBER }, ENV))
				.status,
		).toBe(403);
		mockDb({ role: "agent" });
		expect(
			(
				await tags.request(
					"/tags",
					{ method: "GET", headers: { "x-workspace-id": "ws_1" } },
					ENV,
				)
			).status,
		).toBe(401);
	});
});

describe("POST /tags", () => {
	it("creates a new tag, auto-assigning a palette color when none is given", async () => {
		mockDb({ role: "agent", selectResult: [] }); // no existing match
		const res = await post({ name: "Refunds" });
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			tag: { name: string; color: string };
			created: boolean;
		};
		expect(body.created).toBe(true);
		expect(body.tag.name).toBe("Refunds");
		expect(body.tag.color).toMatch(/^#[0-9a-f]{6}$/i); // assigned from palette
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("honors a provided hex color", async () => {
		mockDb({ role: "agent", selectResult: [] });
		await post({ name: "VIP", color: "#123abc" });
		expect(lastInsert).toMatchObject({ name: "VIP", color: "#123abc" });
	});

	it("dedupes case-insensitively: returns the existing tag, no new row", async () => {
		mockDb({
			role: "agent",
			selectResult: [
				{ id: "t1", workspaceId: "ws_1", name: "Billing", color: "#6366f1" },
			],
		});
		const res = await post({ name: "BILLING" });
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			tag: { id: string };
			created: boolean;
		};
		expect(body.tag.id).toBe("t1");
		expect(body.created).toBe(false);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s an empty name and an over-length name; never inserts", async () => {
		mockDb({ role: "agent", selectResult: [] });
		expect((await post({ name: "   " })).status).toBe(400);
		expect((await post({ name: "x".repeat(41) })).status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("403s a non-member; never inserts", async () => {
		mockDb({ selectResult: [] });
		const res = await post({ name: "Nope" });
		expect(res.status).toBe(403);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});
