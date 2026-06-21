// End-to-end deletion tests: the REAL route + the REAL workspace-deletion service
// + REAL better-auth password verify, executing against a real sqlite (via the
// sqlite-proxy driver) seeded with the actual migrations. Only the session and
// Stripe's network call are mocked. These assert the DATA outcomes the unit tests
// can't: that the user-row set actually empties on success, and that a blocked
// multi-workspace delete touches NOTHING.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { hashPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { schema } from "@llmchat/db";

import { account } from "./account";

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
// Only Stripe's network call is mocked; the gate logic itself runs for real.
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

const n = (sqlite: DatabaseSync, where: string, table: string) =>
	(
		sqlite
			.prepare(`SELECT count(*) AS n FROM "${table}" WHERE ${where}`)
			.get() as {
			n: number;
		}
	).n;

/** Seed a fully-populated workspace `ws`, owned by `owner`, with ids prefixed by
 * `p` so multiple workspaces don't collide. */
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
	body: unknown,
	headers: Record<string, string> = { "x-test-user": "u1" },
) {
	return account.request(
		"/account",
		{
			method: "DELETE",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify(body),
		},
		{ vars: { STRIPE_SECRET_KEY: "sk_test_x" } } as never,
	);
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /account — positive end-to-end (credential user, populated workspace)", () => {
	it("verifies the password, returns 200, and empties EVERY workspace child + the user's own rows", async () => {
		const sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);

		const hash = await hashPassword("correct horse");
		sqlite.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io')`,
		);
		// Both a credential account (password) and a linked Google account.
		sqlite.exec(
			`INSERT INTO account (id,user_id,account_id,provider_id,password) VALUES ('acc1','u1','u1','credential','${hash}'),('acc2','u1','g1','google',NULL)`,
		);
		sqlite.exec(
			`INSERT INTO passkey (id,public_key,user_id,credential_id,counter,device_type,backed_up) VALUES ('pk1','pub','u1','cr',0,'platform',1)`,
		);
		sqlite.exec(
			`INSERT INTO session (id,user_id,token,expires_at) VALUES ('se1','u1','tok',9999)`,
		);
		sqlite.exec(
			`INSERT INTO verification (id,identifier,value,expires_at) VALUES ('v1','u1@x.io','t',9999)`,
		);
		seedWorkspace(sqlite, "ws1", "u1", "a");

		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);

		const res = await del({
			confirmEmail: "u1@x.io",
			password: "correct horse",
		});
		expect(res.status).toBe(200);

		// Every workspace child table is empty…
		for (const t of WS_TABLES) {
			expect(
				(
					sqlite.prepare(`SELECT count(*) AS n FROM "${t}"`).get() as {
						n: number;
					}
				).n,
			).toBe(0);
		}
		// …and the user's own rows are gone (credential + google), passkey, session.
		expect(n(sqlite, "id='u1'", "user")).toBe(0);
		expect(n(sqlite, "user_id='u1'", "account")).toBe(0);
		expect(n(sqlite, "user_id='u1'", "passkey")).toBe(0);
		expect(n(sqlite, "user_id='u1'", "session")).toBe(0);
		// …and the email verification tokens were swept.
		expect(n(sqlite, "identifier='u1@x.io'", "verification")).toBe(0);
	});
});

describe("DELETE /account — abort atomicity (2 owned workspaces, one with an active sub)", () => {
	it("returns 409 and deletes NOTHING — both workspaces and the user survive intact", async () => {
		const sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);

		// OAuth-only user (no credential → no password needed to reach the gate).
		sqlite.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io')`,
		);
		sqlite.exec(
			`INSERT INTO account (id,user_id,account_id,provider_id) VALUES ('acc2','u1','g1','google')`,
		);
		sqlite.exec(
			`INSERT INTO session (id,user_id,token,expires_at) VALUES ('se1','u1','tok',9999)`,
		);
		// ws1: active subscription (blocks). ws2: free, populated.
		seedWorkspace(sqlite, "ws1", "u1", "a", { plan: "growth", sub: "sub_1" });
		seedWorkspace(sqlite, "ws2", "u1", "b");

		// The live gate sees the sub as active ⇒ block.
		vi.mocked(retrieveSubscription).mockResolvedValue({
			id: "sub_1",
			status: "active",
		});
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);

		const res = await del({ confirmEmail: "u1@x.io" });
		expect(res.status).toBe(409);
		expect(await res.json()).toMatchObject({ error: "active_subscription" });

		// NOTHING deleted: both workspaces' full subtrees survive…
		for (const t of WS_TABLES) {
			const c = (
				sqlite.prepare(`SELECT count(*) AS n FROM "${t}"`).get() as {
					n: number;
				}
			).n;
			// workspace/member/project/... each seeded twice (ws1 + ws2).
			expect(c).toBe(2);
		}
		// …and the user + their auth rows are untouched.
		expect(n(sqlite, "id='u1'", "user")).toBe(1);
		expect(n(sqlite, "user_id='u1'", "session")).toBe(1);
		expect(n(sqlite, "user_id='u1'", "account")).toBe(1);
	});
});
