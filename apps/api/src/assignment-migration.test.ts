// Contract test for migration 0027 (conversation assignment, #96 — PR-A of
// docs/goals/assignment.md). Applies the REAL migration files into a real
// sqlite (same loader as workspaces.delete.e2e.test.ts) and pins the exact
// shape + semantics PR-B's consumers will rely on BEFORE any consumer exists:
// max-one-assignee via the PRIMARY KEY, first-wins claim (ON CONFLICT DO
// NOTHING), last-write-wins reassign (ON CONFLICT DO UPDATE), idempotent
// unassign, and the assigned_at default. FKs are asserted as DECLARATIONS
// only — cleanup is explicit by house law (lib/workspace-deletion.ts), so
// enforcement is deliberately not exercised (PRAGMA foreign_keys=OFF, matching
// the delete e2e).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function sortedMigrationFiles(): string[] {
	return readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql"))
		.sort();
}

function applyMigrations(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	for (const f of sortedMigrationFiles()) {
		sqlite.exec(
			readFileSync(join(MIGRATIONS_DIR, f), "utf8")
				.split("--> statement-breakpoint")
				.join("\n"),
		);
	}
	// The 0007/0011/0012 table-rebuild migrations end with PRAGMA
	// foreign_keys=ON, so the initial OFF doesn't survive the loop. The replays
	// below use synthetic ids without parent rows — enforcement stays off here
	// (FK DECLARATIONS are asserted separately; cleanup is explicit by house law).
	sqlite.exec("PRAGMA foreign_keys=OFF;");
}

interface ColumnInfo {
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

describe("migration 0027 — conversation_assignment contract", () => {
	let sqlite: DatabaseSync;

	beforeEach(() => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
	});

	it("is the latest migration file", () => {
		expect(sortedMigrationFiles().at(-1)).toBe(
			"0027_conversation_assignment.sql",
		);
	});

	it("creates the table with the locked column shape (PK conversation_id)", () => {
		const cols = sqlite
			.prepare("PRAGMA table_info(conversation_assignment)")
			.all() as unknown as ColumnInfo[];
		expect(cols.map((c) => c.name)).toEqual([
			"conversation_id",
			"workspace_id",
			"assignee_user_id",
			"assigned_by",
			"assigned_at",
		]);
		const byName = new Map(cols.map((c) => [c.name, c]));
		// PK on conversation_id and nowhere else — this IS the max-one-assignee rail (R2).
		expect(byName.get("conversation_id")).toMatchObject({
			type: "TEXT",
			notnull: 1,
			pk: 1,
		});
		for (const name of ["workspace_id", "assignee_user_id"]) {
			expect(byName.get(name)).toMatchObject({
				type: "TEXT",
				notnull: 1,
				pk: 0,
			});
		}
		// assigned_by nullable: account deletion scrubs it (S6 pattern).
		expect(byName.get("assigned_by")).toMatchObject({
			type: "TEXT",
			notnull: 0,
			pk: 0,
		});
		const assignedAt = byName.get("assigned_at");
		expect(assignedAt).toMatchObject({ type: "INTEGER", notnull: 1, pk: 0 });
		expect(String(assignedAt?.dflt_value)).toContain("unixepoch");
	});

	it("declares the (workspace_id, assignee_user_id) cleanup/filter index", () => {
		const indexes = sqlite
			.prepare("PRAGMA index_list(conversation_assignment)")
			.all() as { name: string; unique: number; origin: string }[];
		const named = indexes.find(
			(i) => i.name === "conversation_assignment_assignee",
		);
		expect(named).toMatchObject({ unique: 0, origin: "c" });
		const cols = sqlite
			.prepare("PRAGMA index_info(conversation_assignment_assignee)")
			.all() as { name: string }[];
		expect(cols.map((c) => c.name)).toEqual([
			"workspace_id",
			"assignee_user_id",
		]);
	});

	it("declares the three FKs with the drafted delete actions", () => {
		const fks = sqlite
			.prepare("PRAGMA foreign_key_list(conversation_assignment)")
			.all() as {
			table: string;
			from: string;
			to: string;
			on_delete: string;
		}[];
		const byFrom = new Map(fks.map((f) => [f.from, f]));
		expect(byFrom.get("conversation_id")).toMatchObject({
			table: "conversation",
			to: "id",
			on_delete: "CASCADE",
		});
		expect(byFrom.get("workspace_id")).toMatchObject({
			table: "workspace",
			to: "id",
			on_delete: "CASCADE",
		});
		expect(byFrom.get("assignee_user_id")).toMatchObject({
			table: "user",
			to: "id",
			on_delete: "NO ACTION",
		});
		expect(fks).toHaveLength(3);
	});

	// ── semantic replays: the exact statement shapes PR-B will issue ──────────

	const insert = (assignee: string, by: string | null = null) =>
		`INSERT INTO conversation_assignment (conversation_id, workspace_id, assignee_user_id, assigned_by)
		 VALUES ('c1', 'w1', '${assignee}', ${by === null ? "NULL" : `'${by}'`})`;

	it("PK rejects a second plain insert for the same conversation", () => {
		sqlite.exec(insert("alice"));
		expect(() => sqlite.exec(insert("bob"))).toThrow(/UNIQUE|PRIMARY/i);
	});

	it("claim shape is first-wins: ON CONFLICT DO NOTHING leaves the row alone", () => {
		sqlite.exec(insert("alice", "alice"));
		sqlite.exec(
			`${insert("bob", "bob")} ON CONFLICT(conversation_id) DO NOTHING`,
		);
		const row = sqlite
			.prepare(
				"SELECT assignee_user_id, assigned_by FROM conversation_assignment WHERE conversation_id = 'c1'",
			)
			.get() as { assignee_user_id: string; assigned_by: string };
		expect(row).toMatchObject({
			assignee_user_id: "alice",
			assigned_by: "alice",
		});
	});

	it("reassign shape is last-write-wins: ON CONFLICT DO UPDATE restamps the row", () => {
		sqlite.exec(insert("alice", "alice"));
		sqlite.exec(
			`INSERT INTO conversation_assignment (conversation_id, workspace_id, assignee_user_id, assigned_by, assigned_at)
			 VALUES ('c1', 'w1', 'bob', 'carol', 12345)
			 ON CONFLICT(conversation_id) DO UPDATE SET
			   assignee_user_id = excluded.assignee_user_id,
			   assigned_by = excluded.assigned_by,
			   assigned_at = excluded.assigned_at`,
		);
		const row = sqlite
			.prepare(
				"SELECT assignee_user_id, assigned_by, assigned_at FROM conversation_assignment WHERE conversation_id = 'c1'",
			)
			.get() as Record<string, unknown>;
		expect(row).toMatchObject({
			assignee_user_id: "bob",
			assigned_by: "carol",
			assigned_at: 12345,
		});
		// Still exactly one row — the upsert never grew a second assignee.
		const n = sqlite
			.prepare("SELECT COUNT(*) AS n FROM conversation_assignment")
			.get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("unassign shape is an idempotent DELETE", () => {
		sqlite.exec(insert("alice"));
		const del = sqlite.prepare(
			"DELETE FROM conversation_assignment WHERE conversation_id = 'c1'",
		);
		expect(del.run().changes).toBe(1);
		expect(del.run().changes).toBe(0); // second delete: no row, no error
	});

	it("assigned_at defaults to now (unixepoch) when omitted", () => {
		const before = Math.floor(Date.now() / 1000);
		sqlite.exec(insert("alice"));
		const row = sqlite
			.prepare(
				"SELECT assigned_at FROM conversation_assignment WHERE conversation_id = 'c1'",
			)
			.get() as { assigned_at: number };
		expect(row.assigned_at).toBeGreaterThanOrEqual(before);
		expect(row.assigned_at).toBeLessThanOrEqual(before + 5);
	});
});
