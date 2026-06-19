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
}

let insertSpy: ReturnType<typeof vi.fn>;
let deleteSpy: ReturnType<typeof vi.fn>;

function mockDb(state: State) {
	insertSpy = vi.fn(() => ({
		values: () => ({ returning: async () => [{ id: "p_new", name: "New" }] }),
	}));
	deleteSpy = vi.fn(() => ({ where: async () => [] }));
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
		// Count queries (projectCount): db.select({n}).from(...).where(...) → [{n}]
		select: () => ({
			from: () => ({ where: async () => [{ n: state.projectCount ?? 0 }] }),
		}),
		insert: insertSpy,
		delete: deleteSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

function req(path: string, init: RequestInit = {}) {
	return projects.request(path, init, ENV);
}

const json = { "content-type": "application/json" };

beforeEach(() => vi.clearAllMocks());

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

	it("lets an unpaid (none) workspace build its first agent (build-first)", async () => {
		mockDb({ role: "owner", plan: "none", projectCount: 0 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(200);
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("blocks a second agent on an unpaid (none) workspace", async () => {
		mockDb({ role: "owner", plan: "none", projectCount: 1 });
		const res = await req("/projects", {
			method: "POST",
			headers: hdr,
			body: JSON.stringify({ name: "Bot" }),
		});
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "project_limit_reached" });
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
