// Contract test for migrations/0023_sequence_dedupe_backfill.sql (#146 PR-A):
// the deterministic re-sequence of conversations holding duplicate
// (conversation_id, sequence) pairs — the debris of the read-count →
// insert(count+1) → bump race — plus the message_count true-up. Runs the REAL
// file contents through the same rig the e2e suites use (split on
// "--> statement-breakpoint", exec the whole batch), against the real schema
// from the earlier migrations. The staging table (_seq_backfill_0023) is a real
// table, not TEMP, so the file stays correct even if the production applier
// runs each statement as a separate session; the naive correlated-subquery
// form was proven wrong in Phase 1 (it re-ranks against partially-updated rows
// mid-UPDATE and leaves a residual collision).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const FILE_0023 = "0023_sequence_dedupe_backfill.sql";

function migrationSql(file: string): string {
	return readFileSync(join(MIGRATIONS_DIR, file), "utf8")
		.split("--> statement-breakpoint")
		.join("\n");
}

/** Apply every migration BEFORE 0023 — the pre-backfill schema the racy code
 * wrote into. Skipping 0023+ (not just 0023 itself) keeps this fixture
 * seedable after 0024 lands its unique index. */
function applyMigrationsBefore0023(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	for (const f of readdirSync(MIGRATIONS_DIR)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		if (f >= "0023") continue;
		sqlite.exec(migrationSql(f));
	}
}

// Fixture, extending the proven Phase-1 scratch case:
//  c1 — the classic race: user(1), then a note(2), an escalate system row(2),
//       an operator reply(2) and the precomputed assistant reply(2) all
//       colliding; count drifted to 3 (the assistant's absolute bump absorbed
//       the interleaved writes). The operator reply's id ('m0') deliberately
//       sorts BEFORE its created_at peers so the assertions pin the createdAt
//       tie-break — an (sequence, id)-only ranking would order it first and
//       fail the role mapping below.
//  c2 — healthy conversation (control: must not be rewritten).
//  c3 — drift only (count 8 ahead of MAX(sequence) 6, NO duplicates): its
//       sequences must NOT be re-numbered, only its count trued.
function seed(sqlite: DatabaseSync) {
	// A table-rebuild migration re-enables foreign keys mid-apply (drizzle's
	// PRAGMA toggle pattern), so switch them back off before seeding the
	// fixture's dangling project reference.
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	sqlite.exec(`
INSERT INTO conversation (id, project_id, client_id, message_count)
VALUES ('c1', 'p', 'v1', 3), ('c2', 'p', 'v2', 2), ('c3', 'p', 'v3', 8);
INSERT INTO message (id, conversation_id, role, content, sequence, created_at)
VALUES
	('m1', 'c1', 'user', 'q', 1, 100),
	('m2', 'c1', 'note', 'n', 2, 105),
	('m3', 'c1', 'system', 'esc', 2, 107),
	('m0', 'c1', 'admin', 'r', 2, 108),
	('m4', 'c1', 'assistant', 'a', 2, 110),
	('x1', 'c2', 'user', 'q', 1, 100),
	('x2', 'c2', 'assistant', 'a', 2, 110),
	('y1', 'c3', 'user', 'q', 1, 100),
	('y2', 'c3', 'assistant', 'a', 6, 110);
`);
}

/** The visible thread order: what every reader (asc sequence, with the
 * migration's own deterministic tie-break) renders. */
function snapshot(sqlite: DatabaseSync) {
	return sqlite
		.prepare(
			`SELECT conversation_id AS conv, id, role, sequence
			 FROM message ORDER BY conversation_id, sequence, created_at, id`,
		)
		.all() as { conv: string; id: string; role: string; sequence: number }[];
}

function duplicatePairs(sqlite: DatabaseSync): number {
	return (
		sqlite
			.prepare(
				`SELECT COUNT(*) AS n FROM (
					SELECT conversation_id, sequence FROM message
					GROUP BY conversation_id, sequence HAVING COUNT(*) > 1)`,
			)
			.get() as { n: number }
	).n;
}

let sqlite: DatabaseSync;

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	applyMigrationsBefore0023(sqlite);
	seed(sqlite);
});

describe("0023 — deterministic dedupe backfill + messageCount true-up", () => {
	it("re-sequences ONLY the affected conversation, gapless 1..N, visible order preserved", () => {
		const orderBefore = snapshot(sqlite).map((r) => r.id);
		expect(duplicatePairs(sqlite)).toBe(1); // c1's four rows at sequence 2

		sqlite.exec(migrationSql(FILE_0023));

		const after = snapshot(sqlite);
		// Visible order (asc sequence, deterministic tie-break) is unchanged.
		expect(after.map((r) => r.id)).toEqual(orderBefore);
		// The raced conversation is now gapless and unique 1..N, in the order
		// the collision actually happened (sequence, then createdAt, then id —
		// the admin row 'm0' lands at 4 by createdAt despite its id sorting
		// first among the collided rows, pinning the tie-break key).
		expect(
			after
				.filter((r) => r.conv === "c1")
				.map((r) => `${r.role}=${r.sequence}`),
		).toEqual(["user=1", "note=2", "system=3", "admin=4", "assistant=5"]);
		expect(duplicatePairs(sqlite)).toBe(0);
		// The healthy conversation is untouched.
		expect(after.filter((r) => r.conv === "c2").map((r) => r.sequence)).toEqual(
			[1, 2],
		);
	});

	it("leaves drift-only conversations un-resequenced (the gap is kept)", () => {
		sqlite.exec(migrationSql(FILE_0023));
		// c3 had NO duplicates — the backfill must not rewrite its sequences,
		// only true its count. The 1→6 gap survives (harmless to every
		// consumer; MAX+1 allocation continues above it).
		expect(
			snapshot(sqlite)
				.filter((r) => r.conv === "c3")
				.map((r) => r.sequence),
		).toEqual([1, 6]);
	});

	it("trues message_count to COUNT(*) for every drifted conversation", () => {
		sqlite.exec(migrationSql(FILE_0023));
		const counts = sqlite
			.prepare(`SELECT id, message_count AS mc FROM conversation ORDER BY id`)
			.all() as { id: string; mc: number }[];
		// c1: 3 → 5 (the absorbed interleaved writes restored);
		// c2: already true, untouched; c3: 8 → 2 (phantom count corrected).
		expect(counts).toEqual([
			{ id: "c1", mc: 5 },
			{ id: "c2", mc: 2 },
			{ id: "c3", mc: 2 },
		]);
		const drifted = sqlite
			.prepare(
				`SELECT COUNT(*) AS n FROM conversation c
				 WHERE c.message_count <> (SELECT COUNT(*) FROM message m
					WHERE m.conversation_id = c.id)`,
			)
			.get() as { n: number };
		expect(drifted.n).toBe(0);
	});

	it("is idempotent on re-run and leaves no staging table behind", () => {
		sqlite.exec(migrationSql(FILE_0023));
		const first = {
			messages: snapshot(sqlite),
			counts: sqlite
				.prepare(`SELECT id, message_count FROM conversation`)
				.all(),
		};
		sqlite.exec(migrationSql(FILE_0023));
		expect(snapshot(sqlite)).toEqual(first.messages);
		expect(
			sqlite.prepare(`SELECT id, message_count FROM conversation`).all(),
		).toEqual(first.counts);
		const staging = sqlite
			.prepare(
				`SELECT COUNT(*) AS n FROM sqlite_master
				 WHERE type = 'table' AND name = '_seq_backfill_0023'`,
			)
			.get() as { n: number };
		expect(staging.n).toBe(0);
	});

	it("no-ops on a clean database (the fresh-deploy / self-hoster path)", () => {
		const clean = new DatabaseSync(":memory:");
		applyMigrationsBefore0023(clean);
		sqlite.exec("SELECT 1"); // keep the seeded db alive for other tests
		clean.exec(migrationSql(FILE_0023));
		expect(
			(
				clean.prepare(`SELECT COUNT(*) AS n FROM message`).get() as {
					n: number;
				}
			).n,
		).toBe(0);
	});
});
