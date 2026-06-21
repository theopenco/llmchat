// End-to-end workspace-delete test: the REAL route + the REAL workspace-deletion
// cascade, executing against a real sqlite (via the sqlite-proxy driver) seeded
// with the actual migrations. Only the session and Stripe's network call are
// mocked. This asserts the DATA outcome the unit test can't: that deleting ONE
// workspace empties that workspace's whole subtree while a SECOND workspace and
// the user survive completely untouched.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { schema } from "@llmchat/db";

import { workspaces } from "./workspaces";

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
// Only Stripe's network call is mocked; the gate logic itself runs for real. A
// free (plan=none, no sub) workspace never reaches it.
vi.mock("@/lib/stripe", () => ({ retrieveSubscription: vi.fn() }));
import { retrieveSubscription } from "@/lib/stripe";

// ─── real sqlite (via proxy) ──────────────────────────────────────────────────

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

const total = (sqlite: DatabaseSync, table: string) =>
	(
		sqlite.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as {
			n: number;
		}
	).n;
const n = (sqlite: DatabaseSync, where: string, table: string) =>
	(
		sqlite
			.prepare(`SELECT count(*) AS n FROM "${table}" WHERE ${where}`)
			.get() as {
			n: number;
		}
	).n;

/** Seed a fully-populated workspace `ws`, owned by `owner`, ids prefixed by `p`. */
function seedWorkspace(
	sqlite: DatabaseSync,
	ws: string,
	owner: string,
	p: string,
	opts: { plan?: string; sub?: string | null } = {},
) {
	const x = (s: string) => sqlite.exec(s);
	x(
		`INSERT INTO workspace (id,name,owner_id,plan,stripe_subscription_id) VALUES ('${ws}','${ws}','${owner}','${opts.plan ?? "none"}',${opts.sub ? `'${opts.sub}'` : "NULL"})`,
	);
	x(
		`INSERT INTO member (id,workspace_id,user_id,role) VALUES ('${p}m','${ws}','${owner}','owner')`,
	);
	x(
		`INSERT INTO project (id,workspace_id,name,public_key,inbound_email_local) VALUES ('${p}p','${ws}','P','${p}pk','${p}in')`,
	);
	x(
		`INSERT INTO conversation (id,project_id,client_id) VALUES ('${p}c','${p}p','cl')`,
	);
	x(
		`INSERT INTO message (id,conversation_id,role,content,sequence) VALUES ('${p}msg','${p}c','user','hi',1)`,
	);
	x(`INSERT INTO source (id,project_id,kind) VALUES ('${p}s','${p}p','url')`);
	x(
		`INSERT INTO system_prompt (id,project_id,name) VALUES ('${p}sp','${p}p','SP')`,
	);
	x(`INSERT INTO tag (id,workspace_id,name) VALUES ('${p}t','${ws}','T')`);
	x(
		`INSERT INTO conversation_tag (id,conversation_id,tag_id) VALUES ('${p}ct','${p}c','${p}t')`,
	);
	x(
		`INSERT INTO read_status (id,conversation_id,user_id) VALUES ('${p}rs','${p}c','${owner}')`,
	);
	x(
		`INSERT INTO usage_event (id,workspace_id,project_id,conversation_id,message_id,model) VALUES ('${p}ue','${ws}','${p}p','${p}c','${p}msg','m')`,
	);
}

const WS_TABLES = [
	"workspace",
	"member",
	"project",
	"conversation",
	"message",
	"source",
	"system_prompt",
	"tag",
	"conversation_tag",
	"read_status",
	"usage_event",
];

function del(
	id: string,
	headers: Record<string, string> = { "x-test-user": "u1" },
) {
	return workspaces.request(
		`/workspaces/${id}`,
		{ method: "DELETE", headers },
		{ vars: { STRIPE_SECRET_KEY: "sk_test_x" } } as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /workspaces/:id — end-to-end cascade (2 owned workspaces)", () => {
	it("empties ONLY the target workspace's subtree; the other workspace + the user survive", async () => {
		const sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);

		sqlite.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io')`,
		);
		sqlite.exec(
			`INSERT INTO session (id,user_id,token,expires_at) VALUES ('se1','u1','tok',9999)`,
		);
		// Two free workspaces, both owned by u1 (so the last-workspace guard passes).
		seedWorkspace(sqlite, "ws1", "u1", "a");
		seedWorkspace(sqlite, "ws2", "u1", "b");

		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);

		const res = await del("ws1");
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true });
		// A free workspace short-circuits the sub-gate — no Stripe call.
		expect(retrieveSubscription).not.toHaveBeenCalled();

		// Exactly ONE of each remains — ws2's subtree, fully intact.
		for (const t of WS_TABLES) expect(total(sqlite, t)).toBe(1);
		expect(n(sqlite, "id='ws1'", "workspace")).toBe(0);
		expect(n(sqlite, "id='ws2'", "workspace")).toBe(1);
		expect(n(sqlite, "workspace_id='ws1'", "member")).toBe(0);
		expect(n(sqlite, "workspace_id='ws2'", "member")).toBe(1);

		// The user is never touched.
		expect(n(sqlite, "id='u1'", "user")).toBe(1);
		expect(n(sqlite, "user_id='u1'", "session")).toBe(1);
	});

	it("a blocked active-sub delete touches NOTHING — both workspaces survive intact", async () => {
		const sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);

		sqlite.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io')`,
		);
		// ws1: active subscription (blocks). ws2: free.
		seedWorkspace(sqlite, "ws1", "u1", "a", { plan: "growth", sub: "sub_1" });
		seedWorkspace(sqlite, "ws2", "u1", "b");

		// The live gate sees the sub as active ⇒ block.
		vi.mocked(retrieveSubscription).mockResolvedValue({
			id: "sub_1",
			status: "active",
		});
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);

		const res = await del("ws1");
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "active_subscription" });

		// Nothing deleted — both subtrees survive.
		for (const t of WS_TABLES) expect(total(sqlite, t)).toBe(2);
	});
});
