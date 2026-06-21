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
	/** Result of the select chain (GET list, or the POST/PATCH dedupe lookup). */
	selectResult?: Record<string, unknown>[];
	/** The tag resolved by query.tag.findFirst (tenant check). undefined ⇒ 404. */
	existingTag?: Record<string, unknown>;
}

let insertSpy: ReturnType<typeof vi.fn>;
let updateSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;
let lastInsert: Record<string, unknown> | null;
/** The object handed to update(tag).set(...) on the last PATCH — lets a test
 * assert ONLY the provided fields are written (no clobbered sibling). */
let lastSet: Record<string, unknown> | null;

function mockDb(state: State) {
	lastInsert = null;
	lastSet = null;
	insertSpy = vi.fn(() => ({
		values: (data: Record<string, unknown>) => {
			lastInsert = data;
			return { returning: async () => [{ id: "tag_new", ...data }] };
		},
	}));
	updateSpy = vi.fn(() => ({
		set: (data: Record<string, unknown>) => {
			lastSet = data;
			return {
				where: () => ({ returning: async () => [{ id: "t1", ...data }] }),
			};
		},
	}));
	deleteSpy = vi.fn(() => ({ where: async () => [] }));
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
			tag: {
				findFirst: async () => state.existingTag,
			},
		},
		select: () => selectChain,
		insert: insertSpy,
		update: updateSpy,
		delete: deleteSpy,
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

const TAG = {
	id: "t1",
	workspaceId: "ws_1",
	name: "Billing",
	color: "#6366f1",
};

function patch(
	body: unknown,
	tagId = "t1",
	headers: Record<string, string> = MEMBER,
) {
	return tags.request(
		`/tags/${tagId}`,
		{ method: "PATCH", headers, body: JSON.stringify(body) },
		ENV,
	);
}
function del(tagId = "t1", headers: Record<string, string> = MEMBER) {
	return tags.request(`/tags/${tagId}`, { method: "DELETE", headers }, ENV);
}

describe("PATCH /tags/:tagId — rename / recolor", () => {
	it("renames a tag (admin); no collision", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		const res = await patch({ name: "Payments" });
		expect(res.status).toBe(200);
		expect(lastSet).toEqual({ name: "Payments" });
		expect(updateSpy).toHaveBeenCalledTimes(1);
	});

	it("recolors a tag to a palette color (admin)", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		const res = await patch({ color: "#ef4444" });
		expect(res.status).toBe(200);
		expect(lastSet).toEqual({ color: "#ef4444" });
	});

	it("PATCH with only color does NOT blank name (per-field, no clobber)", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		await patch({ color: "#10b981" });
		expect(lastSet).toEqual({ color: "#10b981" });
		expect(lastSet).not.toHaveProperty("name");
	});

	it("PATCH with only name does NOT blank color", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		await patch({ name: "Renamed" });
		expect(lastSet).toEqual({ name: "Renamed" });
		expect(lastSet).not.toHaveProperty("color");
	});

	it("allows renaming a tag to its own current name/casing (exclude-self)", async () => {
		// findTagByNameExcluding finds nothing (the only match is the tag itself).
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		const res = await patch({ name: "billing" });
		expect(res.status).toBe(200);
		expect(updateSpy).toHaveBeenCalledTimes(1);
	});

	it("409s a rename colliding (case-insensitively) with a DIFFERENT tag; no update", async () => {
		mockDb({
			role: "admin",
			existingTag: TAG,
			// A different tag already owns this name.
			selectResult: [{ id: "t2", workspaceId: "ws_1", name: "Payments" }],
		});
		const res = await patch({ name: "PAYMENTS" });
		expect(res.status).toBe(409);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("404s a tag from another workspace; no update (no cross-workspace rename)", async () => {
		mockDb({ role: "admin", existingTag: undefined });
		const res = await patch({ name: "X" });
		expect(res.status).toBe(404);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("400s an off-palette color; no update", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		const res = await patch({ color: "#123456" });
		expect(res.status).toBe(400);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("400s empty/whitespace/over-length name; no update", async () => {
		mockDb({ role: "admin", existingTag: TAG, selectResult: [] });
		expect((await patch({ name: "   " })).status).toBe(400);
		expect((await patch({ name: "x".repeat(41) })).status).toBe(400);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("400s an empty body (neither name nor color)", async () => {
		mockDb({ role: "admin", existingTag: TAG });
		const res = await patch({});
		expect(res.status).toBe(400);
	});

	it("403s an agent renaming (manage is admin+); no update", async () => {
		mockDb({ role: "agent", existingTag: TAG });
		const res = await patch({ name: "Nope" });
		expect(res.status).toBe(403);
		expect(updateSpy).not.toHaveBeenCalled();
	});
});

describe("DELETE /tags/:tagId", () => {
	it("deletes a tag (admin); the 0013 cascade clears its associations", async () => {
		mockDb({ role: "admin", existingTag: TAG });
		const res = await del();
		expect(res.status).toBe(200);
		expect(deleteSpy).toHaveBeenCalledTimes(1);
	});

	it("404s a tag from another workspace; never deletes", async () => {
		mockDb({ role: "admin", existingTag: undefined });
		const res = await del();
		expect(res.status).toBe(404);
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("403s an agent deleting; never deletes", async () => {
		mockDb({ role: "agent", existingTag: TAG });
		const res = await del();
		expect(res.status).toBe(403);
		expect(deleteSpy).not.toHaveBeenCalled();
	});
});
