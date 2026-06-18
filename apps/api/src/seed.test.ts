import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { assertDevOnly, resolveDbPath } from "../scripts/seed.mjs";

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = resolve(API_DIR, "migrations");
const SEED_SQL = resolve(API_DIR, "seed/dev-seed.sql");

/** Apply every committed migration (the exact set Ploy deploys) to a fresh DB. */
function migratedDb() {
	const db = new DatabaseSync(":memory:");
	// Sort a copy in filename order (api targets es2022, so `toSorted` isn't in
	// lib here; sorting a fresh copy never mutates the readdir result).
	const files = [...readdirSync(MIGRATIONS_DIR)].filter((f) =>
		f.endsWith(".sql"),
	);
	// oxlint-disable-next-line unicorn/no-array-sort
	files.sort((a, b) => (a < b ? -1 : 1));
	for (const f of files) {
		db.exec(readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"));
	}
	return db;
}

const ADMIN = "admin@example.com";
const WIDGET_KEY = "local-dev-key";

describe("production migrations", () => {
	it("never create the dev admin or demo project", () => {
		const db = migratedDb();
		const admin = db
			.prepare("SELECT count(*) AS c FROM user WHERE email = ?")
			.get(ADMIN) as { c: number };
		const project = db
			.prepare("SELECT count(*) AS c FROM project WHERE public_key = ?")
			.get(WIDGET_KEY) as { c: number };
		expect(admin.c).toBe(0);
		expect(project.c).toBe(0);
		db.close();
	});

	it("contain no seed file (the dev seed lives outside migrations/)", () => {
		const offending = readdirSync(MIGRATIONS_DIR)
			.filter((f) => f.endsWith(".sql"))
			.filter((f) => {
				const sql = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
				return sql.includes(ADMIN) || sql.includes(WIDGET_KEY);
			});
		expect(offending).toEqual([]);
	});
});

describe("dev seed", () => {
	it("creates the admin, owner-membership, and demo project on a migrated DB", () => {
		const db = migratedDb();
		db.exec(readFileSync(SEED_SQL, "utf8"));

		const user = db
			.prepare("SELECT id, email FROM user WHERE email = ?")
			.get(ADMIN) as { id: string; email: string };
		expect(user).toMatchObject({ id: "dev-admin", email: ADMIN });

		const member = db
			.prepare("SELECT role FROM member WHERE user_id = ? AND workspace_id = ?")
			.get("dev-admin", "dev-workspace") as { role: string };
		expect(member.role).toBe("owner");

		const project = db
			.prepare(
				"SELECT public_key, model, notify_email FROM project WHERE id = ?",
			)
			.get("dev-project") as {
			public_key: string;
			model: string;
			notify_email: string;
		};
		expect(project).toMatchObject({
			public_key: WIDGET_KEY,
			model: "gpt-5.4-mini",
			notify_email: ADMIN,
		});
		db.close();
	});

	it("is idempotent — applying twice leaves a single row each", () => {
		const db = migratedDb();
		const sql = readFileSync(SEED_SQL, "utf8");
		db.exec(sql);
		db.exec(sql);

		for (const [table, where] of [
			["user", "email = 'admin@example.com'"],
			["workspace", "id = 'dev-workspace'"],
			["member", "id = 'dev-member'"],
			["project", "id = 'dev-project'"],
		] as const) {
			const row = db
				.prepare(`SELECT count(*) AS c FROM ${table} WHERE ${where}`)
				.get() as { c: number };
			expect(row.c, table).toBe(1);
		}
		db.close();
	});
});

describe("seed runner guards", () => {
	it("refuses to run under NODE_ENV=production", () => {
		expect(() => assertDevOnly({ NODE_ENV: "production" })).toThrow(
			/production/,
		);
	});

	it("allows dev/test and other environments", () => {
		expect(() => assertDevOnly({ NODE_ENV: "development" })).not.toThrow();
		expect(() => assertDevOnly({})).not.toThrow();
	});

	it("honors PLOY_DB_PATH override, else defaults under .ploy", () => {
		expect(resolveDbPath({ PLOY_DB_PATH: "/tmp/custom.db" })).toBe(
			"/tmp/custom.db",
		);
		expect(resolveDbPath({})).toMatch(/\.ploy\/db\/llmchat_db\.db$/);
	});
});
