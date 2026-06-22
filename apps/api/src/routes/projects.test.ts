import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { projects } from "./projects";

// Header-driven fake session so requireSession/requireWorkspace/requireRole run
// for real without standing up Better Auth. `x-test-user` present ⇒ signed in.
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
	typeof projects.request
>[2];

interface State {
	/** Membership role for the requesting user, or undefined = not a member. */
	role?: "owner" | "admin" | "agent";
	existingProject?: Record<string, unknown>;
	/** Workspace plan for the cap/model-gating checks. Defaults to "scale"
	 * (max headroom, all models) so RBAC tests aren't gated by billing. */
	plan?: string;
	/** Existing project count for the project-cap check. Defaults to 0. */
	projectCount?: number;
	/** Rows the /projects/usage aggregate (select→from→where→groupBy) returns. */
	usageRows?: { projectId: string; n: number }[];
}

let insertSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;
let updateSpy: ReturnType<typeof vi.fn>;
/** The exact object handed to `.update().set(...)` on the last PATCH — lets a
 * test assert ONLY the provided fields are written (no defaulted siblings). */
let lastSetData: Record<string, unknown> | null;

function mockDb(state: State) {
	insertSpy = vi.fn(() => ({
		values: () => ({ returning: async () => [{ id: "p_new", name: "New" }] }),
	}));
	deleteSpy = vi.fn(() => ({ where: async () => [] }));
	lastSetData = null;
	updateSpy = vi.fn(() => ({
		set: (data: Record<string, unknown>) => {
			lastSetData = data;
			return {
				where: () => ({ returning: async () => [{ id: "p1", ...data }] }),
			};
		},
	}));
	const fake = {
		query: {
			member: {
				findFirst: async () => (state.role ? { role: state.role } : undefined),
			},
			project: {
				findFirst: async () => state.existingProject,
				findMany: async () => [{ id: "p1", name: "Existing" }],
			},
			workspace: {
				findFirst: async () => ({ plan: state.plan ?? "scale" }),
			},
		},
		// Two select shapes:
		//  - projectCount: db.select({n}).from(...).where(...) — awaited directly.
		//  - usage:        db.select(...).from(...).where(...).groupBy(...).
		// So where() is both a thenable (count) and exposes groupBy (usage).
		select: () => ({
			from: () => ({
				where: () =>
					Object.assign(Promise.resolve([{ n: state.projectCount ?? 0 }]), {
						groupBy: async () => state.usageRows ?? [],
					}),
			}),
		}),
		insert: insertSpy,
		delete: deleteSpy,
		update: updateSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

function req(path: string, init: RequestInit = {}) {
	return projects.request(path, init, ENV);
}

const json = { "content-type": "application/json" };

beforeEach(() => vi.clearAllMocks());

describe("GET /projects/usage — 30-day per-project counts", () => {
	it("returns a { projectId: count } map for the workspace", async () => {
		mockDb({
			role: "agent",
			usageRows: [
				{ projectId: "p1", n: 12 },
				{ projectId: "p2", n: 3 },
			],
		});
		const res = await req("/projects/usage", {
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ usage: { p1: 12, p2: 3 } });
	});

	it("is role-gated — a non-member gets 403, no aggregate", async () => {
		mockDb({}); // not a member
		const res = await req("/projects/usage", {
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" },
		});
		expect(res.status).toBe(403);
	});
});

describe("RBAC — POST /projects (create)", () => {
	it("403s an agent (insufficient_role) and never inserts", async () => {
		mockDb({ role: "agent" });
		const res = await req("/projects", {
			method: "POST",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json },
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "insufficient_role" });
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("lets an admin create", async () => {
		mockDb({ role: "admin" });
		const res = await req("/projects", {
			method: "POST",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json },
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(200);
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("lets an owner create", async () => {
		mockDb({ role: "owner" });
		const res = await req("/projects", {
			method: "POST",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json },
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(200);
	});

	it("403s a non-member (forbidden) before touching the body", async () => {
		mockDb({}); // no role ⇒ not a member
		const res = await req("/projects", {
			method: "POST",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json },
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(403);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s when no workspace is selected", async () => {
		mockDb({ role: "admin" });
		const res = await req("/projects", {
			method: "POST",
			headers: { "x-test-user": "u1", ...json },
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(400);
	});
});

describe("Plan caps — POST /projects (create)", () => {
	const hdr = { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json };

	it("402 project_limit_reached at the plan's project cap, never inserts", async () => {
		// Starter allows 2 projects; already at 2.
		mockDb({ role: "owner", plan: "starter", projectCount: 2 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "project_limit_reached" });
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("402 model_not_allowed when a basic-only plan picks a premium model", async () => {
		mockDb({ role: "owner", plan: "starter", projectCount: 0 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot", model: "claude-opus-4-8" }),
		});
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "model_not_allowed" });
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("allows a premium model on an all-models plan", async () => {
		mockDb({ role: "owner", plan: "scale", projectCount: 0 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot", model: "claude-opus-4-8" }),
		});
		expect(res.status).toBe(200);
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("blocks an unpaid (none) workspace from building — subscription_required, never inserts", async () => {
		// Hard paywall: no sub ⇒ can't build at all (server-side, non-bypassable).
		mockDb({ role: "owner", plan: "none", projectCount: 0 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "subscription_required" });
		expect(insertSpy).not.toHaveBeenCalled();
	});
});

describe("RBAC — read & delete", () => {
	it("lets an agent LIST projects (read is open to members)", async () => {
		mockDb({ role: "agent" });
		const res = await req("/projects", {
			method: "GET",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			projects: [{ id: "p1", name: "Existing" }],
		});
	});

	it("403s an agent deleting a project, never calls delete", async () => {
		mockDb({ role: "agent", existingProject: { id: "p1" } });
		const res = await req("/projects/p1", {
			method: "DELETE",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" },
		});
		expect(res.status).toBe(403);
		expect(deleteSpy).not.toHaveBeenCalled();
	});

	it("lets an admin delete an existing project", async () => {
		mockDb({ role: "admin", existingProject: { id: "p1" } });
		const res = await req("/projects/p1", {
			method: "DELETE",
			headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" },
		});
		expect(res.status).toBe(200);
		expect(deleteSpy).toHaveBeenCalledTimes(1);
	});
});

describe("PATCH /projects/:id — partial update never clobbers siblings", () => {
	const hdr = { "x-test-user": "u1", "x-workspace-id": "ws_1", ...json };

	function patch(body: Record<string, unknown>) {
		return req("/projects/p1", {
			method: "PATCH",
			headers: hdr,
			body: JSON.stringify(body),
		});
	}

	// The core regression: editing ONE field must write ONLY that column. Before
	// the schema split, the create schema's defaults re-materialized every
	// defaulted field on a partial PATCH and wiped the untouched columns.
	it.each([
		["brandColor", "#abcabc"],
		["systemPrompt", "You are a helpful assistant."],
		["welcomeMessage", "Hey there!"],
		["knowledgeText", "some knowledge"],
		["model", "gpt-5.4-mini"],
		["escalationThreshold", 5],
		["name", "Renamed bot"],
	])("PATCH { %s } writes only that field to .set()", async (field, value) => {
		mockDb({ role: "admin", existingProject: { id: "p1" }, plan: "scale" });
		const res = await patch({ [field]: value });
		expect(res.status).toBe(200);
		// Exactly one column written — no defaulted siblings.
		expect(lastSetData).toEqual({ [field]: value });
	});

	it("favorite toggle writes ONLY favorite (the worst clobber path)", async () => {
		mockDb({ role: "admin", existingProject: { id: "p1" } });
		const res = await patch({ favorite: true });
		expect(res.status).toBe(200);
		expect(lastSetData).toEqual({ favorite: true });
	});

	it("pin toggle writes ONLY pinned", async () => {
		mockDb({ role: "admin", existingProject: { id: "p1" } });
		const res = await patch({ pinned: true });
		expect(res.status).toBe(200);
		expect(lastSetData).toEqual({ pinned: true });
	});

	it("the model gate runs ONLY when model is in the request", async () => {
		// Starter disallows premium models. Editing brand color (no model key) must
		// NOT trip the gate — and must not write a model column.
		mockDb({ role: "admin", existingProject: { id: "p1" }, plan: "starter" });
		const ok = await patch({ brandColor: "#123123" });
		expect(ok.status).toBe(200);
		expect(lastSetData).toEqual({ brandColor: "#123123" });

		// Actually changing model to a premium one on starter is still gated.
		mockDb({ role: "admin", existingProject: { id: "p1" }, plan: "starter" });
		const blocked = await patch({ model: "claude-opus-4-8" });
		expect(blocked.status).toBe(402);
		expect(await blocked.json()).toMatchObject({ error: "model_not_allowed" });
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("403s an agent and never updates", async () => {
		mockDb({ role: "agent", existingProject: { id: "p1" } });
		const res = await patch({ brandColor: "#000000" });
		expect(res.status).toBe(403);
		expect(updateSpy).not.toHaveBeenCalled();
	});

	it("404s a project outside the caller's workspace, never updates", async () => {
		mockDb({ role: "admin", existingProject: undefined });
		const res = await patch({ brandColor: "#000000" });
		expect(res.status).toBe(404);
		expect(updateSpy).not.toHaveBeenCalled();
	});
});
