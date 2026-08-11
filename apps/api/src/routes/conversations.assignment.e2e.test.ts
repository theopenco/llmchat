// End-to-end proof of conversation assignment (#96, docs/goals/assignment.md
// — the Phase-2 locked decisions + A1/A2/A3/A5): real handlers against a REAL
// sqlite DB (drizzle sqlite-proxy over the actual migrations, including 0027),
// so tenant isolation, the first-wins claim, the upsert, the filters and the
// lifecycle cleanups are exercised as SQL, not mocks. Sessions are the
// header-driven fake; membership/roles come from the REAL member table.

import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
	createAuth: () => ({
		api: {
			getSession: async ({
				headers,
				returnHeaders,
			}: {
				headers: Headers;
				returnHeaders?: boolean;
			}) => {
				const id = headers.get("x-test-user");
				const session = id ? { user: { id } } : null;
				// Mirror better-auth's real contract: returnHeaders wraps the session in
				// { headers, response } (requireSession forwards refreshed cookies from it).
				return returnHeaders
					? { headers: new Headers(), response: session }
					: session;
			},
		},
	}),
}));
vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/email", async (orig) => ({
	...(await orig<typeof import("@/lib/email")>()),
	sendEmail: vi.fn(async () => ({ id: "email_1" })),
}));
vi.mock("@/lib/posthog", () => ({
	captureEvent: vi.fn(async () => {}),
	captureInBackground: vi.fn(),
}));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));
// The widget poll's gates pass so the R5 serialization pin reaches c.json.
vi.mock("@/lib/kv", () => ({
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
	rateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/llm", () => ({
	generateSuggestion: vi.fn(async () => "draft"),
	resolveServableModel: vi.fn(() => "gpt-5.4-mini"),
}));

import { db } from "@/lib/db";
import { deleteUserRows } from "@/lib/workspace-deletion";
import { applyMigrations, makeProxy } from "@/test/sqlite-rig";

import { conversations } from "./conversations";
import { members } from "./members";
import { widgetMessages } from "./widget-messages";

// ─── seed ────────────────────────────────────────────────────────────────────
// ws1: u1 owner, u2 agent, u3 admin; p1 with c1..c5 (updated_at 101..105).
// ws2: uB owner; p2 with c9. All conversations start unassigned, email-less.

function seed(sqlite: DatabaseSync) {
	const x = (s: string) => sqlite.exec(s);
	for (const [id, email] of [
		["u1", "u1@x.io"],
		["u2", "u2@x.io"],
		["u3", "u3@x.io"],
		["uB", "ub@x.io"],
	] as const) {
		x(`INSERT INTO user (id,name,email) VALUES ('${id}','N ${id}','${email}')`);
	}
	x(`INSERT INTO workspace (id,name,owner_id) VALUES ('ws1','W1','u1')`);
	x(`INSERT INTO workspace (id,name,owner_id) VALUES ('ws2','W2','uB')`);
	x(
		`INSERT INTO member (id,workspace_id,user_id,role) VALUES ('m1','ws1','u1','owner'),('m2','ws1','u2','agent'),('m3','ws1','u3','admin'),('mB','ws2','uB','owner')`,
	);
	x(
		`INSERT INTO project (id,workspace_id,name,public_key,inbound_email_local) VALUES ('p1','ws1','P1','pk1','in1'),('p2','ws2','P2','pk2','in2')`,
	);
	for (const [id, proj, at] of [
		["c1", "p1", 101],
		["c2", "p1", 102],
		["c3", "p1", 103],
		["c4", "p1", 104],
		["c5", "p1", 105],
		["c9", "p2", 106],
	] as const) {
		x(
			`INSERT INTO conversation (id,project_id,client_id,updated_at) VALUES ('${id}','${proj}','cl-${id}',${at})`,
		);
	}
	x(
		`INSERT INTO message (id,conversation_id,role,content,sequence) VALUES ('mm1','c1','user','hello there',1)`,
	);
}

const assignmentRows = (sqlite: DatabaseSync) =>
	sqlite
		.prepare(
			"SELECT conversation_id, workspace_id, assignee_user_id, assigned_by FROM conversation_assignment ORDER BY conversation_id",
		)
		.all() as {
		conversation_id: string;
		workspace_id: string;
		assignee_user_id: string;
		assigned_by: string | null;
	}[];

const conversationRow = (sqlite: DatabaseSync, id: string) =>
	sqlite.prepare("SELECT * FROM conversation WHERE id = ?").get(id);

const ENV = { vars: { INBOUND_EMAIL_DOMAIN: "in.test" } } as never;
const H = (user: string) => ({
	"x-test-user": user,
	"x-workspace-id": "ws1",
	"content-type": "application/json",
});

let sqlite: DatabaseSync;

const idsOf = (body: { conversations: { id: string }[] }) =>
	body.conversations.map((r) => r.id);

function put(user: string, convId: string, body: unknown, project = "p1") {
	return conversations.request(
		`/projects/${project}/conversations/${convId}/assignee`,
		{ method: "PUT", headers: H(user), body: JSON.stringify(body) },
		ENV,
	);
}
function list(user: string, qs = "") {
	return conversations.request(
		`/projects/p1/conversations${qs}`,
		{ headers: H(user) },
		ENV,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	sqlite = new DatabaseSync(":memory:");
	applyMigrations(sqlite);
	seed(sqlite);
	vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
});

describe("PUT /assignee — contract (A1) + RBAC (R3) + tenancy (R2)", () => {
	it("all three roles can assign, and the upsert is last-write-wins with restamped audit", async () => {
		for (const [caller, assignee] of [
			["u1", "u2"],
			["u3", "u1"],
			["u2", "u3"],
		] as const) {
			const res = await put(caller, "c1", { assigneeUserId: assignee });
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
			const rows = assignmentRows(sqlite);
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				conversation_id: "c1",
				workspace_id: "ws1",
				assignee_user_id: assignee,
				assigned_by: caller,
			});
		}
	});

	it("explicit null unassigns and is idempotent; an ABSENT field is a 400, never an unassign (A1)", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });

		// Absent field: zod rejects — the row must survive.
		const missing = await put("u1", "c1", {});
		expect(missing.status).toBe(400);
		expect(assignmentRows(sqlite)).toHaveLength(1);

		const un = await put("u1", "c1", { assigneeUserId: null });
		expect(un.status).toBe(200);
		expect(assignmentRows(sqlite)).toHaveLength(0);

		// Second null: still { ok } (idempotent).
		const again = await put("u1", "c1", { assigneeUserId: null });
		expect(again.status).toBe(200);
	});

	it("400s a non-member assignee (and a removed member), with code not_a_member", async () => {
		const res = await put("u1", "c1", { assigneeUserId: "uB" });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "not_a_member" });

		sqlite.exec(`DELETE FROM member WHERE id = 'm2'`);
		const removed = await put("u1", "c1", { assigneeUserId: "u2" });
		expect(removed.status).toBe(400);
		expect(assignmentRows(sqlite)).toHaveLength(0);
	});

	it("404s cross-tenant targets — foreign conversation under my project path, and a foreign project", async () => {
		// ws2's conversation addressed through ws1's project: conv scoping 404s.
		const conv = await put("u1", "c9", { assigneeUserId: "u2" });
		expect(conv.status).toBe(404);
		// ws2's project under a ws1 session: project scoping 404s.
		const proj = await put("u1", "c9", { assigneeUserId: "u2" }, "p2");
		expect(proj.status).toBe(404);
		expect(assignmentRows(sqlite)).toHaveLength(0);
	});

	it("A5: the conversation row is byte-identical across assign / reassign / unassign (R6)", async () => {
		const before = conversationRow(sqlite, "c1");
		await put("u1", "c1", { assigneeUserId: "u2" });
		expect(conversationRow(sqlite, "c1")).toEqual(before);
		await put("u2", "c1", { assigneeUserId: "u3" });
		expect(conversationRow(sqlite, "c1")).toEqual(before);
		await put("u1", "c1", { assigneeUserId: null });
		expect(conversationRow(sqlite, "c1")).toEqual(before);
	});
});

describe("claim-on-reply (R4/A2)", () => {
	const reply = (user: string, convId: string) =>
		conversations.request(
			`/projects/p1/conversations/${convId}/reply`,
			{
				method: "POST",
				headers: H(user),
				body: JSON.stringify({ content: "on it" }),
			},
			ENV,
		);

	it("the first reply claims an unassigned conversation for the replier", async () => {
		const res = await reply("u2", "c1");
		expect(res.status).toBe(200);
		expect(assignmentRows(sqlite)[0]).toMatchObject({
			conversation_id: "c1",
			workspace_id: "ws1",
			assignee_user_id: "u2",
			assigned_by: "u2",
		});
	});

	it("a reply NEVER reassigns an already-assigned conversation", async () => {
		await put("u1", "c1", { assigneeUserId: "u3" });
		const res = await reply("u2", "c1");
		expect(res.status).toBe(200);
		expect(assignmentRows(sqlite)[0]).toMatchObject({
			assignee_user_id: "u3",
			assigned_by: "u1",
		});
	});

	it("A2: a FAILED reply never claims", async () => {
		// The intended 500 dumps a stack to stderr — keep CI logs readable.
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
		sqlite.exec("DROP TABLE message");
		const res = await reply("u2", "c1");
		expect(res.status).toBe(500);
		expect(assignmentRows(sqlite)).toHaveLength(0);
		quiet.mockRestore();
	});

	it("the claim survives a FAILING email send (claim sits before sendEmail)", async () => {
		sqlite.exec("UPDATE conversation SET email = 'v@x.io' WHERE id = 'c1'");
		const { sendEmail } = await import("@/lib/email");
		vi.mocked(sendEmail).mockRejectedValueOnce(new Error("resend down"));
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await reply("u2", "c1");
		expect(res.status).toBe(500);
		// The reply row + claim both persisted; only the email failed.
		expect(assignmentRows(sqlite)[0]).toMatchObject({
			conversation_id: "c1",
			assignee_user_id: "u2",
		});
		quiet.mockRestore();
	});

	it("notes never claim (structural: the claim lives only in /reply)", async () => {
		const res = await conversations.request(
			`/projects/p1/conversations/c1/notes`,
			{
				method: "POST",
				headers: H("u2"),
				body: JSON.stringify({ content: "note" }),
			},
			ENV,
		);
		expect(res.status).toBe(201);
		expect(assignmentRows(sqlite)).toHaveLength(0);
	});

	it("suggest never claims (whatever its outcome)", async () => {
		const res = await conversations.request(
			`/projects/p1/conversations/c1/suggest`,
			{ method: "POST", headers: H("u2") },
			ENV,
		);
		// Unpaid seed workspace: resolveAccess gates with 402 before any spend.
		expect(res.status).toBe(402);
		expect(assignmentRows(sqlite)).toHaveLength(0);
	});
});

describe("list filters (R6) + serialization", () => {
	beforeEach(async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		await put("u2", "c3", { assigneeUserId: "u1" });
		// c2, c4, c5 stay unassigned; c3 escalated for the compose test.
		sqlite.exec("UPDATE conversation SET escalated_at = 200 WHERE id = 'c3'");
	});

	it("assignee=me is caller-scoped (the and() proof): u1 and u2 see different sets", async () => {
		const mine1 = await (await list("u1", "?status=all&assignee=me")).json();
		expect(idsOf(mine1)).toEqual(["c3"]);
		const mine2 = await (await list("u2", "?status=all&assignee=me")).json();
		expect(idsOf(mine2)).toEqual(["c1"]);
	});

	it("assignee=none returns exactly the unassigned set", async () => {
		const body = await (await list("u1", "?status=all&assignee=none")).json();
		expect(idsOf(body)).toEqual(["c5", "c4", "c2"]);
	});

	it("composes with status + search + tags and with keyset pagination (no dup/skip across the cursor)", async () => {
		const esc = await (
			await list("u1", "?status=escalated&assignee=me")
		).json();
		expect(idsOf(esc)).toEqual(["c3"]);
		const escNone = await (
			await list("u1", "?status=escalated&assignee=none")
		).json();
		expect(idsOf(escNone)).toEqual([]);

		// Search × assignee: name matches on c3 (mine) and c4 (unassigned).
		sqlite.exec(
			"UPDATE conversation SET name = 'Widget question' WHERE id IN ('c3','c4')",
		);
		const searchMine = await (
			await list("u1", "?status=all&assignee=me&search=Widget")
		).json();
		expect(idsOf(searchMine)).toEqual(["c3"]);
		const searchNone = await (
			await list("u1", "?status=all&assignee=none&search=Widget")
		).json();
		expect(idsOf(searchNone)).toEqual(["c4"]);

		// Tags × assignee: t1 on c1 (assigned to u2) and c4 (unassigned).
		sqlite.exec(
			"INSERT INTO tag (id,workspace_id,name) VALUES ('t1','ws1','vip')",
		);
		sqlite.exec(
			"INSERT INTO conversation_tag (id,conversation_id,tag_id) VALUES ('ct1','c1','t1'),('ct2','c4','t1')",
		);
		const tagNone = await (
			await list("u1", "?status=all&assignee=none&tagIds=t1")
		).json();
		expect(idsOf(tagNone)).toEqual(["c4"]);
		const tagMine = await (
			await list("u2", "?status=all&assignee=me&tagIds=t1")
		).json();
		expect(idsOf(tagMine)).toEqual(["c1"]);

		const page1 = await (
			await list("u1", "?status=all&assignee=none&limit=2")
		).json();
		expect(idsOf(page1)).toEqual(["c5", "c4"]);
		expect(page1.nextCursor).toBeTruthy();
		const page2 = await (
			await list(
				"u1",
				`?status=all&assignee=none&limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`,
			)
		).json();
		expect(idsOf(page2)).toEqual(["c2"]);
		expect(page2.nextCursor).toBeNull();
	});

	it("rows carry the explicit assignee view; unassigned rows carry null", async () => {
		const body = await (await list("u1", "?status=all")).json();
		const byId = new Map(
			body.conversations.map((r: { id: string }) => [r.id, r]),
		);
		expect((byId.get("c1") as { assignee: unknown }).assignee).toEqual({
			userId: "u2",
			name: "N u2",
			assignedBy: "u1",
		});
		expect((byId.get("c4") as { assignee: unknown }).assignee).toBeNull();
	});

	it("the thread conversation carries the assignee too", async () => {
		const res = await conversations.request(
			`/projects/p1/conversations/c1`,
			{ headers: H("u3") },
			ENV,
		);
		const body = await res.json();
		expect(body.conversation.assignee).toEqual({
			userId: "u2",
			name: "N u2",
			assignedBy: "u1",
		});
	});
});

describe("stats pill counts (A3)", () => {
	it("mine derives from the SESSION user and unassigned from row absence — project-wide, caller-scoped", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		await put("u2", "c3", { assigneeUserId: "u1" });
		// A ws2 assignment must never bleed into ws1's project stats.
		sqlite.exec(
			`INSERT INTO conversation_assignment (conversation_id,workspace_id,assignee_user_id,assigned_by) VALUES ('c9','ws2','uB','uB')`,
		);

		const stats = async (user: string) => {
			const res = await conversations.request(
				`/projects/p1/conversations/stats`,
				{ headers: H(user) },
				ENV,
			);
			return res.json();
		};

		expect(await stats("u1")).toMatchObject({
			total: 5,
			mine: 1,
			unassigned: 3,
		});
		// The and() proof: same project, different caller, different "mine".
		expect(await stats("u2")).toMatchObject({ mine: 1, unassigned: 3 });
		expect(await stats("u3")).toMatchObject({ mine: 0, unassigned: 3 });
	});
});

describe("R5 — assignment never reaches the visitor surface", () => {
	it("GET /v1/messages serializes no assignment data for an assigned conversation", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		const res = await widgetMessages.request(
			`/messages?projectKey=pk1&clientId=cl-c1`,
			{},
			ENV,
		);
		expect(res.status).toBe(200);
		const raw = JSON.stringify(await res.json());
		expect(raw).not.toContain("assignee");
		expect(raw).not.toContain("assigned");
		// The assignee's identity never appears in any form.
		expect(raw).not.toContain("u2");
	});
});

describe("lifecycle cleanup (R7)", () => {
	it("member removal unassigns them in THIS workspace only; assigned_by attribution stays", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		await put("u2", "c3", { assigneeUserId: "u1" });
		// u2 also assigned in ws2 (seed membership + assignment directly).
		sqlite.exec(
			`INSERT INTO member (id,workspace_id,user_id,role) VALUES ('mX','ws2','u2','agent')`,
		);
		sqlite.exec(
			`INSERT INTO conversation_assignment (conversation_id,workspace_id,assignee_user_id,assigned_by) VALUES ('c9','ws2','u2','uB')`,
		);

		const res = await members.request(
			`/members/u2`,
			{ method: "DELETE", headers: H("u1") },
			ENV,
		);
		expect(res.status).toBe(200);

		const rows = assignmentRows(sqlite);
		// c1 (u2 in ws1) gone; c3 (assigned BY u2, assignee u1) and c9 (u2 in
		// ws2) both survive.
		expect(rows.map((r) => r.conversation_id)).toEqual(["c3", "c9"]);
		expect(rows[0]).toMatchObject({ assigned_by: "u2" });
	});

	it("conversation DELETE removes the assignment row explicitly (real SQL)", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		const res = await conversations.request(
			`/projects/p1/conversations/c1`,
			{ method: "DELETE", headers: H("u3") },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(assignmentRows(sqlite)).toHaveLength(0);
		expect(conversationRow(sqlite, "c1")).toBeUndefined();
	});

	it("account deletion drops their assignee rows everywhere and scrubs assigned_by (S6)", async () => {
		await put("u1", "c1", { assigneeUserId: "u2" });
		await put("u2", "c3", { assigneeUserId: "u1" });
		await deleteUserRows(db(ENV as never), "u2", "u2@x.io");

		const rows = assignmentRows(sqlite);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			conversation_id: "c3",
			assignee_user_id: "u1",
			assigned_by: null,
		});
	});
});
