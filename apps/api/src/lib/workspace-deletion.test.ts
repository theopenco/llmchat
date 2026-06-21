import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb } from "@llmchat/db";

import {
	assertDeletable,
	gateWorkspace,
	userDeleteStatements,
	workspaceDeleteStatements,
	type OwnedWorkspace,
} from "./workspace-deletion";

// retrieveSubscription is mocked so the sub-gate matrix is deterministic and
// makes NO real network call.
vi.mock("@/lib/stripe", () => ({ retrieveSubscription: vi.fn() }));
import { retrieveSubscription } from "@/lib/stripe";

// A build-only drizzle instance (the D1 client is never invoked — we only call
// `.toSQL()` to render the EXACT statements the service generates).
const buildDb = createDb({} as never);

// ─── schema + raw exec helpers ────────────────────────────────────────────────

/** Apply every committed migration to a fresh sqlite db to build the real prod
 * schema (the same source of truth prod uses). */
function freshDb(foreignKeys: boolean): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	db.exec(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"};`);
	const dir = join(process.cwd(), "migrations");
	const files = readdirSync(dir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const f of files) {
		const sql = readFileSync(join(dir, f), "utf8")
			.split("--> statement-breakpoint")
			.join("\n");
		db.exec(sql);
	}
	return db;
}

/** Execute a rendered drizzle statement ({sql, params}) against the raw db. */
function run(
	db: DatabaseSync,
	stmt: { toSQL: () => { sql: string; params: unknown[] } },
) {
	const { sql, params } = stmt.toSQL();
	db.prepare(sql).run(...(params as (string | number | null)[]));
}

function count(db: DatabaseSync, table: string): number {
	return (
		db.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }
	).n;
}

// Seed a complete workspace subtree (one row per table under workspace ws1,
// owned by user u1) plus an UNRELATED workspace ws2/user u2 that must survive.
function seedWorkspace(db: DatabaseSync) {
	const x = (sql: string) => db.exec(sql);
	x(
		`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io'),('u2','U2','u2@x.io')`,
	);
	x(
		`INSERT INTO workspace (id,name,owner_id) VALUES ('ws1','W1','u1'),('ws2','W2','u2')`,
	);
	x(
		`INSERT INTO member (id,workspace_id,user_id,role) VALUES ('m1','ws1','u1','owner'),('m2','ws2','u2','owner')`,
	);
	x(
		`INSERT INTO project (id,workspace_id,name,public_key,inbound_email_local) VALUES ('p1','ws1','P1','pk1','in1'),('p2','ws2','P2','pk2','in2')`,
	);
	x(
		`INSERT INTO conversation (id,project_id,client_id) VALUES ('c1','p1','cl1'),('c2','p2','cl2')`,
	);
	x(
		`INSERT INTO message (id,conversation_id,role,content,sequence) VALUES ('msg1','c1','user','hi',1),('msg2','c2','user','hi',1)`,
	);
	x(
		`INSERT INTO source (id,project_id,kind) VALUES ('s1','p1','url'),('s2','p2','url')`,
	);
	x(
		`INSERT INTO system_prompt (id,project_id,name) VALUES ('sp1','p1','SP'),('sp2','p2','SP')`,
	);
	x(
		`INSERT INTO tag (id,workspace_id,name) VALUES ('t1','ws1','Billing'),('t2','ws2','Bug')`,
	);
	x(
		`INSERT INTO conversation_tag (id,conversation_id,tag_id) VALUES ('ct1','c1','t1'),('ct2','c2','t2')`,
	);
	x(
		`INSERT INTO read_status (id,conversation_id,user_id) VALUES ('rs1','c1','u1'),('rs2','c2','u2')`,
	);
	x(
		`INSERT INTO usage_event (id,workspace_id,project_id,conversation_id,message_id,model) VALUES ('ue1','ws1','p1','c1','msg1','m'),('ue2','ws2','p2','c2','msg2','m')`,
	);
}

const WS_CHILD_TABLES = [
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

describe("deleteWorkspaceCascade — explicit deletes (no reliance on FK cascade)", () => {
	for (const fk of [false, true]) {
		it(`removes every child row of ws1 with foreign_keys=${fk ? "ON" : "OFF"}, leaving ws2 intact`, () => {
			const db = freshDb(fk);
			seedWorkspace(db);

			// Run the REAL generated statements, in order, as a D1 batch would.
			for (const stmt of workspaceDeleteStatements(buildDb, "ws1")) {
				run(db, stmt as never);
			}

			// ws1 and every table under it is empty of ws1's rows…
			expect(count(db, "workspace")).toBe(1); // only ws2 remains
			expect(
				(
					db
						.prepare(`SELECT count(*) AS n FROM workspace WHERE id='ws1'`)
						.get() as { n: number }
				).n,
			).toBe(0);
			for (const t of WS_CHILD_TABLES) {
				const remaining = db
					.prepare(`SELECT count(*) AS n FROM "${t}"`)
					.get() as { n: number };
				// Exactly the ws2 row(s) survive — ws1's child is gone on its own.
				expect(remaining.n).toBe(1);
			}
			// Spot-check: ws1's specific rows are gone, ws2's are present.
			expect(
				(
					db
						.prepare(`SELECT count(*) AS n FROM message WHERE id='msg1'`)
						.get() as { n: number }
				).n,
			).toBe(0);
			expect(
				(
					db
						.prepare(`SELECT count(*) AS n FROM message WHERE id='msg2'`)
						.get() as { n: number }
				).n,
			).toBe(1);
		});
	}
});

describe("userDeleteStatements — explicit user-row deletes, user last, verification swept", () => {
	function seedUser(db: DatabaseSync) {
		db.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io'),('u2','U2','u2@x.io')`,
		);
		db.exec(
			`INSERT INTO session (id,user_id,token,expires_at) VALUES ('se1','u1','tok1',9999),('se2','u2','tok2',9999)`,
		);
		db.exec(
			`INSERT INTO account (id,user_id,account_id,provider_id,password) VALUES ('a1','u1','u1','credential','HASH'),('a2','u1','goog1','google',NULL),('a3','u2','u2','credential','H2')`,
		);
		db.exec(
			`INSERT INTO passkey (id,public_key,user_id,credential_id,counter,device_type,backed_up) VALUES ('pk1','pub','u1','cred',0,'platform',1)`,
		);
		db.exec(
			`INSERT INTO verification (id,identifier,value,expires_at) VALUES ('v1','u1@x.io','tok',9999),('v2','other@x.io','tok',9999)`,
		);
		// u1 authored an admin reply in a SURVIVING conversation (different workspace).
		db.exec(
			`INSERT INTO workspace (id,name,owner_id) VALUES ('ws2','W2','u2')`,
		);
		db.exec(
			`INSERT INTO project (id,workspace_id,name,public_key,inbound_email_local) VALUES ('p2','ws2','P2','pk2','in2')`,
		);
		db.exec(
			`INSERT INTO conversation (id,project_id,client_id) VALUES ('c2','p2','cl2')`,
		);
		db.exec(
			`INSERT INTO message (id,conversation_id,role,content,sequence,author_user_id) VALUES ('msg2','c2','admin','reply',1,'u1')`,
		);
		db.exec(
			`INSERT INTO member (id,workspace_id,user_id,role) VALUES ('m2','ws2','u1','agent')`,
		);
		db.exec(
			`INSERT INTO read_status (id,conversation_id,user_id) VALUES ('rs2','c2','u1')`,
		);
	}

	it("deletes all of u1's rows, nulls authored messages, sweeps verification, keeps u2 (FK off)", () => {
		const db = freshDb(false);
		seedUser(db);

		for (const stmt of userDeleteStatements(buildDb, "u1", "u1@x.io")) {
			run(db, stmt as never);
		}

		const c = (t: string, w: string) =>
			(
				db.prepare(`SELECT count(*) AS n FROM "${t}" WHERE ${w}`).get() as {
					n: number;
				}
			).n;
		expect(c("user", "id='u1'")).toBe(0);
		expect(c("user", "id='u2'")).toBe(1); // unrelated user survives
		expect(c("session", "user_id='u1'")).toBe(0);
		expect(c("account", "user_id='u1'")).toBe(0); // BOTH credential + google rows gone
		expect(c("passkey", "user_id='u1'")).toBe(0);
		expect(c("member", "user_id='u1'")).toBe(0);
		expect(c("read_status", "user_id='u1'")).toBe(0);
		// Verification swept by email; the unrelated identifier remains.
		expect(c("verification", "identifier='u1@x.io'")).toBe(0);
		expect(c("verification", "identifier='other@x.io'")).toBe(1);
		// The authored message survives but is disowned (author nulled), not deleted.
		expect(c("message", "id='msg2'")).toBe(1);
		expect(c("message", "id='msg2' AND author_user_id IS NULL")).toBe(1);
		// u2's credential account is untouched.
		expect(c("account", "id='a3'")).toBe(1);
	});

	it("self-only: the user DELETE is keyed to the given id, never a smuggled value", () => {
		const stmts = userDeleteStatements(buildDb, "u1", "u1@x.io");
		const userDelete = stmts[stmts.length - 1]!.toSQL();
		expect(userDelete.params).toContain("u1");
		expect(userDelete.params).not.toContain("victim");
	});
});

describe("sub-gate matrix (live + fail-closed)", () => {
	const ENV = (secret?: string) =>
		({ vars: { STRIPE_SECRET_KEY: secret } }) as never;
	const ws = (over: Partial<OwnedWorkspace>): OwnedWorkspace => ({
		id: "ws1",
		plan: "none",
		stripeSubscriptionId: null,
		...over,
	});

	beforeEach(() => {
		vi.mocked(retrieveSubscription).mockReset();
		// gateWorkspace logs on the fail-closed path; keep the suite quiet.
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("free / no-sub workspace: ALLOW with NO Stripe call", async () => {
		const r = await gateWorkspace(
			ws({ plan: "none", stripeSubscriptionId: null }),
			ENV("sk_x"),
		);
		expect(r.blocked).toBe(false);
		expect(retrieveSubscription).not.toHaveBeenCalled();
	});

	it.each(["active", "trialing", "past_due", "unpaid", "paused"])(
		"status %s → BLOCK active_subscription",
		async (status) => {
			vi.mocked(retrieveSubscription).mockResolvedValue({
				id: "sub_1",
				status,
			});
			const r = await gateWorkspace(
				ws({ stripeSubscriptionId: "sub_1" }),
				ENV("sk_x"),
			);
			expect(r).toMatchObject({ blocked: true, reason: "active_subscription" });
		},
	);

	it.each(["canceled", "incomplete", "incomplete_expired"])(
		"status %s → ALLOW",
		async (status) => {
			vi.mocked(retrieveSubscription).mockResolvedValue({
				id: "sub_1",
				status,
			});
			const r = await gateWorkspace(
				ws({ stripeSubscriptionId: "sub_1" }),
				ENV("sk_x"),
			);
			expect(r.blocked).toBe(false);
		},
	);

	it("Stripe error → fail closed (billing_unverified)", async () => {
		vi.mocked(retrieveSubscription).mockImplementation(async () => {
			throw new Error("network");
		});
		const r = await gateWorkspace(
			ws({ stripeSubscriptionId: "sub_1" }),
			ENV("sk_x"),
		);
		expect(r).toMatchObject({ blocked: true, reason: "billing_unverified" });
	});

	it("missing secret with a sub id → fail closed (billing_unverified), no call", async () => {
		const r = await gateWorkspace(
			ws({ stripeSubscriptionId: "sub_1" }),
			ENV(undefined),
		);
		expect(r).toMatchObject({ blocked: true, reason: "billing_unverified" });
		expect(retrieveSubscription).not.toHaveBeenCalled();
	});

	it("paid plan but NO sub id (drift) → fail closed (billing_drift), no call", async () => {
		const r = await gateWorkspace(
			ws({ plan: "growth", stripeSubscriptionId: null }),
			ENV("sk_x"),
		);
		expect(r).toMatchObject({ blocked: true, reason: "billing_drift" });
		expect(retrieveSubscription).not.toHaveBeenCalled();
	});

	it("assertDeletable returns the FIRST blocker across workspaces", async () => {
		vi.mocked(retrieveSubscription).mockResolvedValue({
			id: "s",
			status: "active",
		});
		const r = await assertDeletable(
			[
				ws({ id: "free", plan: "none", stripeSubscriptionId: null }),
				ws({ id: "paid", stripeSubscriptionId: "sub_1" }),
			],
			ENV("sk_x"),
		);
		expect(r).toMatchObject({
			blocked: true,
			reason: "active_subscription",
			workspaceId: "paid",
		});
	});
});
