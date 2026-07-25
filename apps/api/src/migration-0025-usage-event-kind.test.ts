// Contract test for migrations/0025_usage_event_kind.sql (#98 PR-A, the
// migrate-before-serve half): the `kind` discriminator that lets operator-side
// AI-suggestion usage be RECORDED without being COUNTED as a visitor response.
// Pins the three properties the follow-up PR's code will rely on: (1) every
// pre-0025 row backfills to 'chat' (they are all /v1/chat responses — the
// table's only historical writer), (2) an insert that omits `kind` still gets
// 'chat' (the live chat writer never names the column, so it stays compatible
// across the deploy window), and (3) the quota query shape the follow-up adds
// (`WHERE kind = 'chat'`) excludes suggestion rows.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const FILE_0025 = "0025_usage_event_kind.sql";

function migrationSql(file: string): string {
	return readFileSync(join(MIGRATIONS_DIR, file), "utf8")
		.split("--> statement-breakpoint")
		.join("\n");
}

function applyMigrationsBefore0025(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	for (const f of readdirSync(MIGRATIONS_DIR)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		if (f >= "0025") continue;
		sqlite.exec(migrationSql(f));
	}
}

// A pre-0025 usage row: the shape the sole production writer (chat.ts) emits —
// messageId always "", costUsd always 0.
function seedPreColumnRow(sqlite: DatabaseSync) {
	sqlite.exec("PRAGMA foreign_keys=OFF;");
	sqlite.exec(`
INSERT INTO usage_event (id, workspace_id, project_id, conversation_id, message_id, model, prompt_tokens, completion_tokens, cost_usd, created_at)
VALUES ('u1', 'ws', 'p', 'c', '', 'gpt-5.4-mini', 100, 50, 0, 1750000000);
`);
}

let sqlite: DatabaseSync;

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	applyMigrationsBefore0025(sqlite);
	seedPreColumnRow(sqlite);
});

describe("0025 — usage_event.kind discriminator", () => {
	it("adds kind NOT NULL DEFAULT 'chat' and backfills every existing row to 'chat'", () => {
		sqlite.exec(migrationSql(FILE_0025));
		const col = (
			sqlite.prepare("PRAGMA table_info(usage_event)").all() as {
				name: string;
				notnull: number;
				dflt_value: string | null;
			}[]
		).find((c) => c.name === "kind");
		expect(col).toBeDefined();
		expect(col!.notnull).toBe(1);
		expect(col!.dflt_value).toBe("'chat'");
		const row = sqlite
			.prepare("SELECT kind FROM usage_event WHERE id = 'u1'")
			.get() as { kind: string };
		expect(row.kind).toBe("chat");
	});

	it("a kind-omitting insert (the live chat writer) still lands as 'chat'; explicit 'suggestion' works", () => {
		sqlite.exec(migrationSql(FILE_0025));
		sqlite.exec(`
INSERT INTO usage_event (id, workspace_id, project_id, conversation_id, message_id, model, prompt_tokens, completion_tokens, cost_usd, created_at)
VALUES ('u2', 'ws', 'p', 'c', '', 'gpt-5.4-mini', 10, 5, 0, 1750000100);
INSERT INTO usage_event (id, workspace_id, project_id, conversation_id, message_id, model, prompt_tokens, completion_tokens, cost_usd, created_at, kind)
VALUES ('u3', 'ws', 'p', 'c', '', 'gpt-5.4-mini', 10, 5, 0, 1750000200, 'suggestion');
`);
		const kinds = (
			sqlite.prepare("SELECT id, kind FROM usage_event ORDER BY id").all() as {
				id: string;
				kind: string;
			}[]
		).map((r) => `${r.id}=${r.kind}`);
		expect(kinds).toEqual(["u1=chat", "u2=chat", "u3=suggestion"]);
	});

	it("the follow-up's quota query shape (WHERE kind='chat') excludes suggestion rows", () => {
		sqlite.exec(migrationSql(FILE_0025));
		sqlite.exec(`
INSERT INTO usage_event (id, workspace_id, project_id, conversation_id, message_id, model, prompt_tokens, completion_tokens, cost_usd, created_at, kind)
VALUES ('s1', 'ws', 'p', 'c', '', 'gpt-5.4-mini', 10, 5, 0, 1750000300, 'suggestion'),
       ('s2', 'ws', 'p', 'c', '', 'gpt-5.4-mini', 10, 5, 0, 1750000400, 'suggestion');
`);
		const { all, chatOnly } = {
			all: (
				sqlite
					.prepare(
						"SELECT COUNT(*) AS n FROM usage_event WHERE workspace_id = 'ws'",
					)
					.get() as { n: number }
			).n,
			chatOnly: (
				sqlite
					.prepare(
						"SELECT COUNT(*) AS n FROM usage_event WHERE workspace_id = 'ws' AND kind = 'chat'",
					)
					.get() as { n: number }
			).n,
		};
		expect(all).toBe(3);
		expect(chatOnly).toBe(1); // only the pre-column backfilled row
	});

	it("full-chain 0000→0025 applies clean on a fresh database (new deploys / self-hosters)", () => {
		const clean = new DatabaseSync(":memory:");
		clean.exec("PRAGMA foreign_keys=OFF;");
		for (const f of readdirSync(MIGRATIONS_DIR)
			.filter((x) => x.endsWith(".sql"))
			.sort()) {
			clean.exec(migrationSql(f));
		}
		const cols = (
			clean.prepare("PRAGMA table_info(usage_event)").all() as {
				name: string;
			}[]
		).map((c) => c.name);
		expect(cols).toContain("kind");
		expect(
			(
				clean.prepare("SELECT COUNT(*) AS n FROM usage_event").get() as {
					n: number;
				}
			).n,
		).toBe(0);
	});
});
