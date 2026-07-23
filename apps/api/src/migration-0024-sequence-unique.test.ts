// Contract test for migrations/0024_sequence_unique.sql (#146 PR-C, the
// closer): the belt-dedupe (same staging-table form 0023 proved, catching any
// duplicate minted in the 0023→code-switch deploy window) followed by the
// UNIQUE (conversation_id, sequence) index that makes the sequence race
// physically impossible. CREATE UNIQUE INDEX cannot succeed while a duplicate
// exists — so the 0024 deploy succeeding IS the proof that prod holds zero
// duplicate pairs (recorded on the PR in lieu of a console Q1 run).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const FILE_0024 = "0024_sequence_unique.sql";

function migrationSql(file: string): string {
	return readFileSync(join(MIGRATIONS_DIR, file), "utf8")
		.split("--> statement-breakpoint")
		.join("\n");
}

/** Everything before 0024 — the schema the deploy window ran on (0023 applied,
 * old plain index still in place, no uniqueness yet). */
function applyMigrationsBefore0024(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	for (const f of readdirSync(MIGRATIONS_DIR)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		if (f >= "0024") continue;
		sqlite.exec(migrationSql(f));
	}
}

// Window fixture: cw holds a duplicate pair minted BETWEEN 0023 and the
// code-switch deploy (old precompute racing) with the classic drifted count;
// cok is healthy and must survive untouched.
function seed(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	sqlite.exec(`
INSERT INTO conversation (id, project_id, client_id, message_count)
VALUES ('cw', 'p', 'v1', 2), ('cok', 'p', 'v2', 2);
INSERT INTO message (id, conversation_id, role, content, sequence, created_at)
VALUES
	('w1', 'cw', 'user', 'q', 1, 100),
	('w2', 'cw', 'admin', 'r', 2, 105),
	('w3', 'cw', 'assistant', 'a', 2, 110),
	('k1', 'cok', 'user', 'q', 1, 100),
	('k2', 'cok', 'assistant', 'a', 2, 110);
`);
}

function indexNames(sqlite: DatabaseSync): string[] {
	return (
		sqlite
			.prepare(
				`SELECT name FROM sqlite_master
				 WHERE type = 'index' AND tbl_name = 'message' AND name NOT LIKE 'sqlite_%'
				 ORDER BY name`,
			)
			.all() as { name: string }[]
	).map((r) => r.name);
}

let sqlite: DatabaseSync;

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	applyMigrationsBefore0024(sqlite);
	seed(sqlite);
});

describe("0024 — belt dedupe, then the unique index", () => {
	it("clears window-minted duplicates, trues counts, swaps the index", () => {
		expect(indexNames(sqlite)).toContain("message_conv_seq"); // the old plain index
		sqlite.exec(migrationSql(FILE_0024));
		const cw = sqlite
			.prepare(
				"SELECT role, sequence FROM message WHERE conversation_id = 'cw' ORDER BY sequence",
			)
			.all() as { role: string; sequence: number }[];
		expect(cw.map((r) => `${r.role}=${r.sequence}`)).toEqual([
			"user=1",
			"admin=2",
			"assistant=3",
		]);
		const counts = sqlite
			.prepare("SELECT id, message_count AS mc FROM conversation ORDER BY id")
			.all() as { id: string; mc: number }[];
		expect(counts).toEqual([
			{ id: "cok", mc: 2 },
			{ id: "cw", mc: 3 },
		]);
		const names = indexNames(sqlite);
		expect(names).toContain("message_conv_seq_uidx");
		expect(names).not.toContain("message_conv_seq");
	});

	it("a direct duplicate insert now throws loudly — the race is physically impossible", () => {
		sqlite.exec(migrationSql(FILE_0024));
		expect(() =>
			sqlite.exec(
				`INSERT INTO message (id, conversation_id, role, content, sequence, created_at)
				 VALUES ('dup', 'cok', 'note', 'x', 2, 999)`,
			),
		).toThrow(/UNIQUE constraint failed/i);
		// The atomic-subquery allocation (what insertMessage emits) still works
		// under the index — the next free slot, never a collision.
		sqlite.exec(
			`INSERT INTO message (id, conversation_id, role, content, sequence, created_at)
			 VALUES ('ok', 'cok', 'note', 'x',
				(SELECT COALESCE(MAX(sequence), 0) + 1 FROM message WHERE conversation_id = 'cok'), 999)`,
		);
		expect(
			(
				sqlite
					.prepare("SELECT sequence FROM message WHERE id = 'ok'")
					.get() as { sequence: number }
			).sequence,
		).toBe(3);
	});

	it("is re-run safe and no-ops on a clean database (fresh deploys / self-hosters)", () => {
		sqlite.exec(migrationSql(FILE_0024));
		sqlite.exec(migrationSql(FILE_0024)); // IF EXISTS / IF NOT EXISTS guards
		expect(indexNames(sqlite)).toContain("message_conv_seq_uidx");
		const clean = new DatabaseSync(":memory:");
		clean.exec("PRAGMA foreign_keys=OFF;");
		for (const f of readdirSync(MIGRATIONS_DIR)
			.filter((x) => x.endsWith(".sql"))
			.sort()) {
			clean.exec(migrationSql(f)); // the FULL chain, 0000 → 0024
		}
		expect(indexNames(clean)).toContain("message_conv_seq_uidx");
		expect(
			(
				clean.prepare("SELECT COUNT(*) AS n FROM message").get() as {
					n: number;
				}
			).n,
		).toBe(0);
	});

	it("FAILS LOUDLY (deploy-visible) if duplicates exist when the index is created", () => {
		// cw still holds its duplicate pair (the belt has NOT run in this test
		// path) — creating the unique index over live duplicates must abort the
		// migration, never quietly skip enforcement. In prod this state is
		// unreachable (the belt runs first in the same file, and no old writer
		// exists once PR-B serves), but if it ever happened the deploy fails
		// visibly and the idempotent file simply re-runs.
		expect(() =>
			sqlite.exec(
				"CREATE UNIQUE INDEX probe_uidx ON message (conversation_id, sequence);",
			),
		).toThrow(/UNIQUE constraint failed/i);
	});
});
