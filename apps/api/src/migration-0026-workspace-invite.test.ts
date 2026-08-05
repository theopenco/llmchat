// Contract test for migrations/0026_workspace_invite.sql (invites PR-A, the
// migrate-before-serve half — docs/goals/invites.md R1). Pins the shapes the
// follow-up PR's code will rely on: (1) the column contract (token HASH only,
// nullable created_by for the S6 scrub, timestamp-modeled status), (2) the
// token_hash unique index (the accept path's lookup key and replay tripwire),
// (3) the atomic single-use burn UPDATE — second burn of the same token
// matches zero rows, (4) the seat-guarded INSERT…SELECT the accept race relies
// on — zero rows when the workspace is at cap. Existing tables and rows are
// untouched: this migration is a pure CREATE.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const FILE_0026 = "0026_workspace_invite.sql";

function migrationSql(file: string): string {
	return readFileSync(join(MIGRATIONS_DIR, file), "utf8")
		.split("--> statement-breakpoint")
		.join("\n");
}

function applyMigrationsBefore0026(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	for (const f of readdirSync(MIGRATIONS_DIR)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		if (f >= "0026") continue;
		sqlite.exec(migrationSql(f));
	}
}

function insertInvite(
	sqlite: DatabaseSync,
	over: Partial<Record<string, string | number | null>> = {},
) {
	const row = {
		id: "inv1",
		workspace_id: "ws",
		email: "new@acme.com",
		role: "agent",
		token_hash: "h1",
		created_by: "u_owner",
		expires_at: 1760000000,
		...over,
	};
	sqlite
		.prepare(
			`INSERT INTO workspace_invite (id, workspace_id, email, role, token_hash, created_by, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			row.id!,
			row.workspace_id!,
			row.email!,
			row.role!,
			row.token_hash!,
			row.created_by as string,
			row.expires_at!,
		);
}

let sqlite: DatabaseSync;

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	applyMigrationsBefore0026(sqlite);
	// A pre-existing member row (prod has hand-inserted ones — R7): the
	// migration must leave it exactly as it was. A migration in the chain flips
	// foreign_keys back on, so re-disable before seeding parentless rows.
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	sqlite.exec(`
INSERT INTO member (id, workspace_id, user_id, role, created_at)
VALUES ('m1', 'ws', 'u_owner', 'owner', 1750000000);
`);
});

describe("0026 — workspace_invite table", () => {
	it("creates the column contract: hash-only token, nullable created_by, timestamp status", () => {
		sqlite.exec(migrationSql(FILE_0026));
		const cols = Object.fromEntries(
			(
				sqlite.prepare("PRAGMA table_info(workspace_invite)").all() as {
					name: string;
					notnull: number;
					dflt_value: string | null;
				}[]
			).map((c) => [c.name, c]),
		);
		expect(Object.keys(cols).sort()).toEqual([
			"accepted_at",
			"accepted_by",
			"created_at",
			"created_by",
			"email",
			"expires_at",
			"id",
			"revoked_at",
			"role",
			"token_hash",
			"workspace_id",
		]);
		// there is no plaintext token column — the hash is the only secret at rest
		expect(cols.token_hash.notnull).toBe(1);
		expect(cols.email.notnull).toBe(1);
		expect(cols.expires_at.notnull).toBe(1);
		expect(cols.role.notnull).toBe(1);
		expect(cols.role.dflt_value).toBe("'agent'");
		// nullable: created_by (S6 scrub target), accepted_by/accepted_at/revoked_at (status)
		expect(cols.created_by.notnull).toBe(0);
		expect(cols.accepted_by.notnull).toBe(0);
		expect(cols.accepted_at.notnull).toBe(0);
		expect(cols.revoked_at.notnull).toBe(0);
	});

	it("token_hash is unique; workspace_id is indexed but NOT unique (many pending invites per workspace)", () => {
		sqlite.exec(migrationSql(FILE_0026));
		insertInvite(sqlite);
		insertInvite(sqlite, { id: "inv2", email: "other@acme.com", token_hash: "h2" });
		expect(() =>
			insertInvite(sqlite, { id: "inv3", token_hash: "h1" }),
		).toThrow(/UNIQUE/);
		const uniqueIndexes = (
			sqlite.prepare("PRAGMA index_list(workspace_invite)").all() as {
				name: string;
				unique: number;
			}[]
		)
			.filter((i) => i.unique === 1 && !i.name.startsWith("sqlite_autoindex"))
			.map((i) => i.name);
		expect(uniqueIndexes).toEqual(["workspace_invite_token_hash"]);
	});

	it("the follow-up's single-use burn UPDATE matches once and never again", () => {
		sqlite.exec(migrationSql(FILE_0026));
		insertInvite(sqlite);
		const burn = sqlite.prepare(
			`UPDATE workspace_invite
			 SET accepted_at = ?, accepted_by = ?
			 WHERE token_hash = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
		);
		const first = burn.run(1755000000, "u_new", "h1", 1755000000 - 1);
		expect(first.changes).toBe(1);
		// replay of the same token: zero rows — the single-use guarantee
		const replay = burn.run(1755000001, "u_thief", "h1", 1755000000);
		expect(replay.changes).toBe(0);
		// a revoked pending invite is equally unburnable
		insertInvite(sqlite, { id: "inv2", token_hash: "h2" });
		sqlite.exec(
			"UPDATE workspace_invite SET revoked_at = 1755000000 WHERE id = 'inv2'",
		);
		expect(burn.run(1755000001, "u_new", "h2", 1755000000).changes).toBe(0);
	});

	it("the follow-up's seat-guarded INSERT…SELECT inserts under cap and no-ops at cap", () => {
		sqlite.exec(migrationSql(FILE_0026));
		const guarded = sqlite.prepare(
			`INSERT INTO member (id, workspace_id, user_id, role, created_at)
			 SELECT ?, ?, ?, ?, ?
			 WHERE (SELECT COUNT(*) FROM member WHERE workspace_id = ?) < ?`,
		);
		// 1 existing member, cap 3 → inserts
		expect(
			guarded.run("m2", "ws", "u_new", "agent", 1755000000, "ws", 3).changes,
		).toBe(1);
		// 2 existing members, cap 2 → zero rows, seat race lost
		expect(
			guarded.run("m3", "ws", "u_late", "agent", 1755000001, "ws", 2).changes,
		).toBe(0);
		expect(
			(
				sqlite
					.prepare("SELECT COUNT(*) AS n FROM member WHERE workspace_id='ws'")
					.get() as { n: number }
			).n,
		).toBe(2);
	});

	it("touches nothing else: the pre-existing member row survives byte-for-byte and the new table is empty", () => {
		const before = sqlite.prepare("SELECT * FROM member WHERE id='m1'").get();
		sqlite.exec(migrationSql(FILE_0026));
		expect(sqlite.prepare("SELECT * FROM member WHERE id='m1'").get()).toEqual(
			before,
		);
		expect(
			(
				sqlite.prepare("SELECT COUNT(*) AS n FROM workspace_invite").get() as {
					n: number;
				}
			).n,
		).toBe(0);
	});

	it("full-chain 0000→0026 applies clean on a fresh database (new deploys / self-hosters)", () => {
		const clean = new DatabaseSync(":memory:");
		clean.exec("PRAGMA foreign_keys=OFF;");
		for (const f of readdirSync(MIGRATIONS_DIR)
			.filter((x) => x.endsWith(".sql"))
			.sort()) {
			clean.exec(migrationSql(f));
		}
		const cols = (
			clean.prepare("PRAGMA table_info(workspace_invite)").all() as {
				name: string;
			}[]
		).map((c) => c.name);
		expect(cols).toContain("token_hash");
	});
});
