// Shared sqlite-proxy rig for e2e suites: the REAL migrations applied into an
// in-memory sqlite, exposed to route code via drizzle's sqlite-proxy driver.
// Extracted when the assignment suite (#96) needed the identical rig as
// workspaces.delete.e2e — including the non-obvious re-assert below, which one
// drifted copy silently lacked for months.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";

import { schema } from "@llmchat/db";

export function applyMigrations(sqlite: DatabaseSync) {
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
	// The 0007/0011/0012 table-rebuild migrations end with PRAGMA
	// foreign_keys=ON, silently defeating the OFF above. Consumers of this rig
	// prove cleanup happens via OUR explicit deletes (never the FK cascade)
	// and/or seed synthetic ids without parent rows — so FKs must be off AFTER
	// the loop, not just before it.
	sqlite.exec("PRAGMA foreign_keys=OFF;");
}

export function makeProxy(sqlite: DatabaseSync) {
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
