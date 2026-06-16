// Dev-only seed runner.
//
// Applies apps/api/seed/dev-seed.sql to the LOCAL Ploy SQLite database so the
// dashboard/showcase work out-of-the-box (admin@example.com / local-dev-key).
//
// This is deliberately separate from apps/api/migrations/: Ploy auto-applies
// every migration on `ploy dev` AND on deploy, so anything in there would also
// run in production. The seed must never touch prod, hence this opt-in script.
//
// Usage:  pnpm seed            (after `pnpm dev` has created the local DB)
//         PLOY_DB_PATH=/path pnpm seed   (override DB location)

import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../..");
const SEED_SQL = resolve(here, "../seed/dev-seed.sql");
const DEFAULT_DB = resolve(REPO_ROOT, ".ploy/db/llmchat_db.db");

/**
 * The seed creates a known admin with a committed password hash. Refuse to run
 * anywhere that looks like production, so it can never be wired into a deploy.
 */
export function assertDevOnly(env = process.env) {
	if (env.NODE_ENV === "production") {
		throw new Error(
			"refusing to seed: NODE_ENV=production. The dev seed must never run in production.",
		);
	}
}

/** Local Ploy DB path, overridable via PLOY_DB_PATH for non-default setups. */
export function resolveDbPath(env = process.env) {
	return env.PLOY_DB_PATH ? resolve(env.PLOY_DB_PATH) : DEFAULT_DB;
}

function main() {
	assertDevOnly();

	const dbPath = resolveDbPath();
	if (!existsSync(dbPath)) {
		console.error(
			`No local DB at ${dbPath}.\nStart the dev server once (\`pnpm dev\`) so Ploy creates and migrates it, then re-run \`pnpm seed\`.`,
		);
		process.exit(1);
	}

	const sql = readFileSync(SEED_SQL, "utf8");
	const db = new DatabaseSync(dbPath);
	try {
		// Coexist with the running Ploy emulator holding the same file.
		db.exec("PRAGMA busy_timeout = 5000;");
		db.exec(sql);
	} finally {
		db.close();
	}

	console.log(
		"✔ dev seed applied — sign in at the dashboard with admin@example.com / admin@example.com (widget key: local-dev-key)",
	);
}

// Only run when invoked directly, so tests can import the guards without seeding.
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main();
}
