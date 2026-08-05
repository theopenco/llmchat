// End-to-end proof of the member-invites security envelope
// (docs/goals/invites.md R8 + the locked Phase-2 decisions): real handlers
// against a REAL sqlite DB (drizzle sqlite-proxy over the actual migrations,
// including 0026), the REAL kv rate limiter over a STATE stub, and the REAL
// resolveAccess entitlement path — so tenant isolation, the burn/seat
// atomics, and the fail-closed buckets are exercised as SQL/code, not mocks.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { schema } from "@llmchat/db";

import type { AppContext } from "@/env";

// Header-driven fake session: `x-test-user` present ⇒ signed in as that id.
// Membership/roles come from the REAL member table.
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
// Outbound email is spied; escapeHtml stays real. kv is REAL (fail-closed
// behavior is under test) — STATE is an in-memory stub per env.
vi.mock("@/lib/email", async (orig) => ({
	...(await orig<typeof import("@/lib/email")>()),
	sendEmail: vi.fn(async () => ({ id: "email_1" })),
}));
vi.mock("@/lib/posthog", () => ({
	captureEvent: vi.fn(async () => {}),
	captureInBackground: vi.fn(),
}));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { captureInBackground } from "@/lib/posthog";

import { invites } from "./invites";
import { members } from "./members";

// ─── real sqlite via proxy (same rig as internal-notes.e2e) ─────────────────
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

// Fixture: ws_1 ("Acme", growth → 10 seats) with owner/admin/agent; ws_2
// (starter) owned by u_out, with u_agent as a second membership so u_agent can
// leave ws_1; ws_cap (starter → 3 seats) starts at 2 members so cap tests can
// mint an invite first and fill the last seat afterwards.
function seed(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	sqlite.exec(`
INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES
 ('u_owner', 'Olive Owner', 'owner@acme.com', 1, 1750000000, 1750000000),
 ('u_admin', 'Ada Admin', 'admin@acme.com', 0, 1750000000, 1750000000),
 ('u_agent', 'Aki Agent', 'agent@acme.com', 0, 1750000000, 1750000000),
 ('u_new', 'Noor New', 'new@fresh.com', 0, 1750000000, 1750000000),
 ('u_other', 'Odd Other', 'other@fresh.com', 0, 1750000000, 1750000000),
 ('u_out', 'Out Sider', 'out@rival.com', 1, 1750000000, 1750000000);
INSERT INTO workspace (id, name, owner_id, plan, created_at) VALUES
 ('ws_1', 'Acme', 'u_owner', 'growth', 1750000000),
 ('ws_2', 'Rival', 'u_out', 'starter', 1750000000),
 ('ws_cap', 'Capped', 'u_owner', 'starter', 1750000000);
INSERT INTO member (id, workspace_id, user_id, role, created_at) VALUES
 ('m1', 'ws_1', 'u_owner', 'owner', 1750000001),
 ('m2', 'ws_1', 'u_admin', 'admin', 1750000002),
 ('m3', 'ws_1', 'u_agent', 'agent', 1750000003),
 ('m4', 'ws_2', 'u_out', 'owner', 1750000001),
 ('m5', 'ws_2', 'u_agent', 'agent', 1750000002),
 ('m6', 'ws_cap', 'u_owner', 'owner', 1750000001),
 ('m7', 'ws_cap', 'u_admin', 'admin', 1750000002);
INSERT INTO project (id, workspace_id, name, public_key, inbound_email_local, created_at) VALUES
 ('p1', 'ws_1', 'Acme Site', 'pk_1', 'acme1', 1750000000),
 ('p2', 'ws_2', 'Rival Site', 'pk_2', 'rival1', 1750000000);
INSERT INTO conversation (id, project_id, client_id, created_at, updated_at) VALUES
 ('c1', 'p1', 'client_1', 1750000000, 1750000000),
 ('c2', 'p2', 'client_2', 1750000000, 1750000000);
INSERT INTO message (id, conversation_id, sequence, role, content, author_user_id, created_at) VALUES
 ('msg1', 'c1', 1, 'admin', 'hello from the team', 'u_agent', 1750000010);
INSERT INTO read_status (id, conversation_id, user_id, last_read_message_count, read_at) VALUES
 ('rs1', 'c1', 'u_agent', 1, 1750000020),
 ('rs2', 'c2', 'u_agent', 1, 1750000020);
`);
}

// ─── env / app plumbing ─────────────────────────────────────────────────────
type Env = AppContext["Bindings"];

function memState() {
	const m = new Map<string, string>();
	return {
		get: async (k: string) => m.get(k) ?? null,
		set: async (k: string, v: string) => {
			m.set(k, v);
		},
	};
}

function brokenState() {
	return {
		get: async () => {
			throw new Error("STATE down");
		},
		set: async () => {
			throw new Error("STATE down");
		},
	};
}

function makeEnv(
	vars: Record<string, string> = {},
	state: unknown = memState(),
) {
	return {
		vars: { DASHBOARD_URL: "https://app.example.com", ...vars },
		DB: {},
		STATE: state,
	} as unknown as Env;
}

const app = new Hono<AppContext>();
app.route("/api", invites);
app.route("/api", members);

let sqlite: DatabaseSync;
let ENV: Env;

beforeEach(() => {
	vi.clearAllMocks();
	sqlite = new DatabaseSync(":memory:");
	applyMigrations(sqlite);
	seed(sqlite);
	vi.mocked(db).mockReturnValue(
		makeProxy(sqlite) as unknown as ReturnType<typeof db>,
	);
	ENV = makeEnv();
});

const json = { "content-type": "application/json" };

function asUser(userId: string | null, workspaceId?: string) {
	return {
		...(userId ? { "x-test-user": userId } : {}),
		...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
		...json,
	};
}

async function createInvite(
	over: { email?: string; role?: string; as?: string; ws?: string } = {},
	env = ENV,
) {
	const res = await app.request(
		"/api/invites",
		{
			method: "POST",
			headers: asUser(over.as ?? "u_owner", over.ws ?? "ws_1"),
			body: JSON.stringify({
				email: over.email ?? "new@fresh.com",
				role: over.role ?? "agent",
			}),
		},
		env,
	);
	return res;
}

function tokenFromLink(link: string) {
	return link.split("/invite/")[1]!;
}

async function accept(token: string, userId: string, env = ENV, ws?: string) {
	return app.request(
		"/api/invites/accept",
		{
			method: "POST",
			headers: asUser(userId, ws),
			body: JSON.stringify({ token }),
		},
		env,
	);
}

function memberRow(workspaceId: string, userId: string) {
	return sqlite
		.prepare("SELECT * FROM member WHERE workspace_id = ? AND user_id = ?")
		.get(workspaceId, userId) as Record<string, unknown> | undefined;
}

function inviteRow(id: string) {
	return sqlite
		.prepare("SELECT * FROM workspace_invite WHERE id = ?")
		.get(id) as Record<string, unknown> | undefined;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("invite creation — roles, limits, token hygiene", () => {
	it("owner invites an agent: 200, row stored with hash only, link returned ONCE, email sent", async () => {
		const res = await createInvite();
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			invite: Record<string, unknown>;
			link: string;
			emailSent: boolean;
		};
		expect(body.emailSent).toBe(true);
		expect(body.link).toMatch(/^https:\/\/app\.example\.com\/invite\/.{20,}/);
		const token = tokenFromLink(body.link);
		// The invite object never carries token material…
		expect(body.invite.tokenHash).toBeUndefined();
		expect(JSON.stringify(body.invite)).not.toContain(token);
		// …and the stored row holds a 64-hex hash, not the token.
		const row = inviteRow(body.invite.id as string)!;
		expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(row.token_hash).not.toBe(token);
		expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(1);
		const sent = vi.mocked(sendEmail).mock.calls[0]![1];
		expect(sent.to).toBe("new@fresh.com");
		expect(sent.html).toContain(body.link);
	});

	it("stores the email lowercased (A2) and delivers to the address as given", async () => {
		const res = await createInvite({ email: "MiXeD@Fresh.COM" });
		expect(res.status).toBe(200);
		const { invite } = (await res.json()) as {
			invite: { id: string; email: string };
		};
		expect(invite.email).toBe("mixed@fresh.com");
		expect(inviteRow(invite.id)!.email).toBe("mixed@fresh.com");
	});

	it("admin can invite an agent but NOT an admin (owner-only); owner can mint admin", async () => {
		expect((await createInvite({ as: "u_admin", role: "agent" })).status).toBe(
			200,
		);
		const denied = await createInvite({ as: "u_admin", role: "admin" });
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({ code: "insufficient_role" });
		expect((await createInvite({ as: "u_owner", role: "admin" })).status).toBe(
			200,
		);
	});

	it("agent cannot create invites; crafted role 'owner' is rejected by the schema", async () => {
		expect((await createInvite({ as: "u_agent" })).status).toBe(403);
		expect((await createInvite({ role: "owner" })).status).toBe(400);
	});

	it("re-invite replaces: the prior pending invite for the same email is revoked", async () => {
		const first = (await (await createInvite()).json()) as { link: string };
		const second = (await (await createInvite()).json()) as { link: string };
		const oldAccept = await accept(tokenFromLink(first.link), "u_new");
		expect(oldAccept.status).toBe(410);
		expect(await oldAccept.json()).toMatchObject({ error: "invite_revoked" });
		expect(memberRow("ws_1", "u_new")).toBeUndefined();
		expect((await accept(tokenFromLink(second.link), "u_new")).status).toBe(
			200,
		);
	});

	it("store-before-send: a failed email still leaves the invite + link (recoverable)", async () => {
		vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));
		const res = await createInvite();
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			invite: { id: string };
			link: string;
			emailSent: boolean;
		};
		expect(body.emailSent).toBe(false);
		expect(inviteRow(body.invite.id)).toBeDefined();
		expect((await accept(tokenFromLink(body.link), "u_new")).status).toBe(200);
	});

	it("advisory seat check at create: a full workspace 402s member_limit_reached", async () => {
		sqlite.exec(
			`INSERT INTO member (id, workspace_id, user_id, role, created_at) VALUES ('m8', 'ws_cap', 'u_agent', 'agent', 1750000003)`,
		);
		const res = await createInvite({ ws: "ws_cap" });
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "member_limit_reached" });
	});

	it("creation buckets fail CLOSED on a STATE outage", async () => {
		const res = await createInvite({}, makeEnv({}, brokenState()));
		expect(res.status).toBe(429);
	});
});

describe("invite listing / preview — no token material leaves", () => {
	it("GET /invites lists pending with inviter name and zero token material", async () => {
		const created = (await (await createInvite()).json()) as { link: string };
		const token = tokenFromLink(created.link);
		const res = await app.request(
			"/api/invites",
			{ headers: asUser("u_owner", "ws_1") },
			ENV,
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain(token);
		expect(text).not.toContain("tokenHash");
		const { invites: rows } = JSON.parse(text) as {
			invites: { email: string; inviterName: string | null }[];
		};
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			email: "new@fresh.com",
			inviterName: "Olive Owner",
		});
	});

	it("list is admin-gated; agents get 403 with an explicit code", async () => {
		const res = await app.request(
			"/api/invites",
			{ headers: asUser("u_agent", "ws_1") },
			ENV,
		);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "insufficient_role" });
	});

	it("preview shows workspace/role/email without burning, and echoes no token", async () => {
		const created = (await (await createInvite()).json()) as { link: string };
		const token = tokenFromLink(created.link);
		const res = await app.request(
			"/api/invites/preview",
			{
				method: "POST",
				headers: asUser("u_new"),
				body: JSON.stringify({ token }),
			},
			ENV,
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain(token);
		expect(JSON.parse(text)).toEqual({
			workspaceName: "Acme",
			role: "agent",
			email: "new@fresh.com",
			inviterName: "Olive Owner",
		});
		// Not burned: the accept still succeeds.
		expect((await accept(token, "u_new")).status).toBe(200);
	});
});

describe("accept — possession, single-use, tenant isolation", () => {
	it("happy path: the invitee joins with the invited role; invite marked accepted", async () => {
		const created = (await (
			await createInvite({ role: "admin", as: "u_owner" })
		).json()) as { invite: { id: string }; link: string };
		const res = await accept(tokenFromLink(created.link), "u_new");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ workspaceId: "ws_1" });
		expect(memberRow("ws_1", "u_new")).toMatchObject({ role: "admin" });
		const row = inviteRow(created.invite.id)!;
		expect(row.accepted_at).not.toBeNull();
		expect(row.accepted_by).toBe("u_new");
	});

	it("ignores x-workspace-id entirely: membership lands in the token's workspace", async () => {
		const created = (await (await createInvite()).json()) as { link: string };
		const res = await accept(tokenFromLink(created.link), "u_new", ENV, "ws_2");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ workspaceId: "ws_1" });
		expect(memberRow("ws_1", "u_new")).toBeDefined();
		expect(memberRow("ws_2", "u_new")).toBeUndefined();
	});

	it("a used token 410s invite_used for the second bearer — burn-before-insert", async () => {
		const created = (await (await createInvite()).json()) as { link: string };
		const token = tokenFromLink(created.link);
		expect((await accept(token, "u_new")).status).toBe(200);
		const replay = await accept(token, "u_other");
		expect(replay.status).toBe(410);
		expect(await replay.json()).toMatchObject({ error: "invite_used" });
		expect(memberRow("ws_1", "u_other")).toBeUndefined();
	});

	it("replay after revoke: 410 invite_revoked, no member row", async () => {
		const created = (await (await createInvite()).json()) as {
			invite: { id: string };
			link: string;
		};
		const revoke = await app.request(
			`/api/invites/${created.invite.id}/revoke`,
			{ method: "POST", headers: asUser("u_owner", "ws_1") },
			ENV,
		);
		expect(revoke.status).toBe(200);
		const res = await accept(tokenFromLink(created.link), "u_new");
		expect(res.status).toBe(410);
		expect(await res.json()).toMatchObject({ error: "invite_revoked" });
		expect(memberRow("ws_1", "u_new")).toBeUndefined();
	});

	it("expired invite: 410 invite_expired, no member row", async () => {
		const created = (await (await createInvite()).json()) as {
			invite: { id: string };
			link: string;
		};
		sqlite
			.prepare(`UPDATE workspace_invite SET expires_at = 1000 WHERE id = ?`)
			.run(created.invite.id);
		const res = await accept(tokenFromLink(created.link), "u_new");
		expect(res.status).toBe(410);
		expect(await res.json()).toMatchObject({ error: "invite_expired" });
		expect(memberRow("ws_1", "u_new")).toBeUndefined();
	});

	it("an existing member accepting 409s already_member and burns nothing", async () => {
		const created = (await (
			await createInvite({ email: "agent@acme.com" })
		).json()) as { invite: { id: string }; link: string };
		const res = await accept(tokenFromLink(created.link), "u_agent");
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({
			error: "already_member",
			workspaceId: "ws_1",
		});
		expect(inviteRow(created.invite.id)!.accepted_at).toBeNull();
		expect(memberRow("ws_1", "u_agent")).toMatchObject({ role: "agent" });
	});

	it("a garbage token 404s invalid_invite", async () => {
		const res = await accept("x".repeat(43), "u_new");
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ error: "invalid_invite" });
	});

	it("accept bucket fails CLOSED on a STATE outage", async () => {
		const created = (await (await createInvite()).json()) as { link: string };
		const res = await accept(
			tokenFromLink(created.link),
			"u_new",
			makeEnv({}, brokenState()),
		);
		expect(res.status).toBe(429);
		expect(memberRow("ws_1", "u_new")).toBeUndefined();
	});

	it("unauthenticated accept/preview/create/list/revoke are all 401", async () => {
		for (const [path, init] of [
			["/api/invites", { headers: asUser(null, "ws_1") }],
			[
				"/api/invites",
				{
					method: "POST",
					headers: asUser(null, "ws_1"),
					body: JSON.stringify({ email: "a@b.co", role: "agent" }),
				},
			],
			[
				"/api/invites/i1/revoke",
				{ method: "POST", headers: asUser(null, "ws_1") },
			],
			[
				"/api/invites/preview",
				{
					method: "POST",
					headers: asUser(null),
					body: JSON.stringify({ token: "t".repeat(43) }),
				},
			],
			[
				"/api/invites/accept",
				{
					method: "POST",
					headers: asUser(null),
					body: JSON.stringify({ token: "t".repeat(43) }),
				},
			],
		] as const) {
			const res = await app.request(path, init as RequestInit, ENV);
			expect(res.status).toBe(401);
		}
	});
});

describe("seat enforcement at accept — the atomic guard + compensation", () => {
	it("last seat: first accept wins, second 402s and its invite is UN-burned (recoverable)", async () => {
		// ws_cap has 2/3 seats used; mint two invites while a seat is free.
		const inv1 = (await (
			await createInvite({ ws: "ws_cap", email: "new@fresh.com" })
		).json()) as { invite: { id: string }; link: string };
		const inv2 = (await (
			await createInvite({ ws: "ws_cap", email: "other@fresh.com" })
		).json()) as { invite: { id: string }; link: string };

		expect((await accept(tokenFromLink(inv1.link), "u_new")).status).toBe(200);
		const lost = await accept(tokenFromLink(inv2.link), "u_other");
		expect(lost.status).toBe(402);
		expect(await lost.json()).toMatchObject({ error: "member_limit_reached" });
		expect(memberRow("ws_cap", "u_other")).toBeUndefined();
		// Compensation: the losing invite is pending again, not consumed.
		expect(inviteRow(inv2.invite.id)!.accepted_at).toBeNull();
		expect(inviteRow(inv2.invite.id)!.accepted_by).toBeNull();
	});

	it("exempt (internal) workspaces have unlimited seats end to end", async () => {
		const env = makeEnv({ INTERNAL_ACCOUNT_EMAILS: "owner@acme.com" });
		sqlite.exec(
			`INSERT INTO member (id, workspace_id, user_id, role, created_at) VALUES ('m8', 'ws_cap', 'u_agent', 'agent', 1750000003)`,
		);
		// 3/3 seats used on starter — create AND accept still pass when exempt.
		const created = await createInvite({ ws: "ws_cap" }, env);
		expect(created.status).toBe(200);
		const { link } = (await created.json()) as { link: string };
		expect((await accept(tokenFromLink(link), "u_new", env)).status).toBe(200);
		expect(memberRow("ws_cap", "u_new")).toBeDefined();
	});
});

describe("token hygiene — logs and analytics (R5/A1 api side)", () => {
	it("the token never appears in console output or analytics payloads", async () => {
		const logSpy = vi.spyOn(console, "log");
		const errSpy = vi.spyOn(console, "error");
		const created = (await (await createInvite()).json()) as { link: string };
		const token = tokenFromLink(created.link);
		expect((await accept(token, "u_new")).status).toBe(200);

		const logged = [...logSpy.mock.calls, ...errSpy.mock.calls]
			.flat()
			.map(String)
			.join("\n");
		expect(logged).not.toContain(token);

		const captured = vi.mocked(captureInBackground).mock.calls;
		expect(captured.length).toBeGreaterThanOrEqual(2);
		const payloads = JSON.stringify(captured.map((c) => c[1]));
		expect(payloads).not.toContain(token);
		expect(payloads).not.toContain("new@fresh.com");
		const events = captured.map((c) => (c[1] as { event: string }).event);
		expect(events).toContain("invite_sent");
		expect(events).toContain("invite_accepted");
		logSpy.mockRestore();
		errSpy.mockRestore();
	});
});

describe("cross-workspace revoke — tenant isolation (R8)", () => {
	it("another workspace's admin cannot revoke ws_1's invite (404, still redeemable)", async () => {
		const created = (await (await createInvite()).json()) as {
			invite: { id: string };
			link: string;
		};
		const res = await app.request(
			`/api/invites/${created.invite.id}/revoke`,
			{ method: "POST", headers: asUser("u_out", "ws_2") },
			ENV,
		);
		expect(res.status).toBe(404);
		expect((await accept(tokenFromLink(created.link), "u_new")).status).toBe(
			200,
		);
	});
});

describe("members — list, role change, removal", () => {
	it("any member lists members with names, emails, roles, and seat usage", async () => {
		const res = await app.request(
			"/api/members",
			{ headers: asUser("u_agent", "ws_1") },
			ENV,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			members: { userId: string; role: string; name: string; email: string }[];
			seats: { used: number; max: number | null };
		};
		expect(body.members.map((m) => `${m.userId}:${m.role}`)).toEqual([
			"u_owner:owner",
			"u_admin:admin",
			"u_agent:agent",
		]);
		expect(body.seats).toEqual({ used: 3, max: 10 });
	});

	it("exempt workspaces report unlimited seats as max: null", async () => {
		const env = makeEnv({ INTERNAL_ACCOUNT_EMAILS: "owner@acme.com" });
		const res = await app.request(
			"/api/members",
			{ headers: asUser("u_owner", "ws_1") },
			env,
		);
		const body = (await res.json()) as { seats: { max: number | null } };
		expect(body.seats.max).toBeNull();
	});

	it("owner changes a role; non-owners are refused with an explicit code", async () => {
		const ok = await app.request(
			"/api/members/u_agent",
			{
				method: "PATCH",
				headers: asUser("u_owner", "ws_1"),
				body: JSON.stringify({ role: "admin" }),
			},
			ENV,
		);
		expect(ok.status).toBe(200);
		expect(memberRow("ws_1", "u_agent")).toMatchObject({ role: "admin" });

		const denied = await app.request(
			"/api/members/u_agent",
			{
				method: "PATCH",
				headers: asUser("u_admin", "ws_1"),
				body: JSON.stringify({ role: "agent" }),
			},
			ENV,
		);
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({ code: "insufficient_role" });
	});

	it("crafted role 'owner' on PATCH is a schema 400; unknown target is 404 not_member", async () => {
		const crafted = await app.request(
			"/api/members/u_agent",
			{
				method: "PATCH",
				headers: asUser("u_owner", "ws_1"),
				body: JSON.stringify({ role: "owner" }),
			},
			ENV,
		);
		expect(crafted.status).toBe(400);
		const missing = await app.request(
			"/api/members/u_ghost",
			{
				method: "PATCH",
				headers: asUser("u_owner", "ws_1"),
				body: JSON.stringify({ role: "agent" }),
			},
			ENV,
		);
		expect(missing.status).toBe(404);
		expect(await missing.json()).toMatchObject({ error: "not_member" });
	});

	it("the last owner can be neither demoted nor removed (409 last_owner)", async () => {
		const demote = await app.request(
			"/api/members/u_owner",
			{
				method: "PATCH",
				headers: asUser("u_owner", "ws_1"),
				body: JSON.stringify({ role: "admin" }),
			},
			ENV,
		);
		expect(demote.status).toBe(409);
		expect(await demote.json()).toMatchObject({ error: "last_owner" });

		const remove = await app.request(
			"/api/members/u_owner",
			{ method: "DELETE", headers: asUser("u_owner", "ws_1") },
			ENV,
		);
		expect(remove.status).toBe(409);
		expect(await remove.json()).toMatchObject({ error: "last_owner" });
	});

	it("with a hand-inserted co-owner (R7) the original owner CAN step down", async () => {
		sqlite.exec(
			`INSERT INTO member (id, workspace_id, user_id, role, created_at) VALUES ('m9', 'ws_1', 'u_new', 'owner', 1750000009)`,
		);
		const res = await app.request(
			"/api/members/u_owner",
			{
				method: "PATCH",
				headers: asUser("u_owner", "ws_1"),
				body: JSON.stringify({ role: "admin" }),
			},
			ENV,
		);
		expect(res.status).toBe(200);
		expect(memberRow("ws_1", "u_owner")).toMatchObject({ role: "admin" });
	});

	it("owner removes a member: row + THIS workspace's read watermarks go, attribution stays", async () => {
		const res = await app.request(
			"/api/members/u_agent",
			{ method: "DELETE", headers: asUser("u_owner", "ws_1") },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(memberRow("ws_1", "u_agent")).toBeUndefined();
		// read_status: ws_1's row deleted, ws_2's survives.
		const rs = sqlite
			.prepare(`SELECT id FROM read_status WHERE user_id = 'u_agent'`)
			.all() as { id: string }[];
		expect(rs.map((r) => r.id)).toEqual(["rs2"]);
		// authorUserId survives removal (S6: only account deletion scrubs).
		expect(
			(
				sqlite
					.prepare(`SELECT author_user_id FROM message WHERE id = 'msg1'`)
					.get() as { author_user_id: string }
			).author_user_id,
		).toBe("u_agent");
		// The user row itself is untouched.
		expect(
			sqlite.prepare(`SELECT id FROM user WHERE id = 'u_agent'`).get(),
		).toBeDefined();
	});

	it("non-owners cannot remove others (403 code), but CAN leave (self-removal)", async () => {
		const denied = await app.request(
			"/api/members/u_admin",
			{ method: "DELETE", headers: asUser("u_agent", "ws_1") },
			ENV,
		);
		expect(denied.status).toBe(403);
		expect(await denied.json()).toMatchObject({ code: "insufficient_role" });

		// u_agent has a second workspace (ws_2), so leaving ws_1 is allowed.
		const leave = await app.request(
			"/api/members/u_agent",
			{ method: "DELETE", headers: asUser("u_agent", "ws_1") },
			ENV,
		);
		expect(leave.status).toBe(200);
		expect(memberRow("ws_1", "u_agent")).toBeUndefined();
		expect(memberRow("ws_2", "u_agent")).toBeDefined();
	});

	it("leaving your LAST workspace is refused (409 last_workspace)", async () => {
		// u_admin also holds a ws_cap seat in the fixture — drop it so ws_1
		// really is their last workspace.
		sqlite.exec(`DELETE FROM member WHERE id = 'm7'`);
		const res = await app.request(
			"/api/members/u_admin",
			{ method: "DELETE", headers: asUser("u_admin", "ws_1") },
			ENV,
		);
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "last_workspace" });
		expect(memberRow("ws_1", "u_admin")).toBeDefined();
	});

	it("members routes are 401 unauthenticated and 403 for non-members", async () => {
		expect(
			(
				await app.request(
					"/api/members",
					{ headers: asUser(null, "ws_1") },
					ENV,
				)
			).status,
		).toBe(401);
		expect(
			(
				await app.request(
					"/api/members",
					{ headers: asUser("u_out", "ws_1") },
					ENV,
				)
			).status,
		).toBe(403);
	});
});
