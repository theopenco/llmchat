// Paywall-after-create end-to-end: proves that creating a workspace grants NO
// free building capacity. A workspace is provisioned through the REAL
// provisionWorkspace (so it gets the schema's plan=none default, exactly like
// POST /api/workspaces does), then the REAL projects route + REAL resolveAccess
// gate run against it over a real sqlite. The build must still 402 — workspace
// creation can't be used to slip past the subscription wall.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { provisionWorkspace } from "@/lib/provisioning";
import { schema } from "@llmchat/db";

import { projects } from "./projects";

// Header-driven fake session so requireSession/requireWorkspace/requireRole run
// for real without standing up Better Auth.
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

// No INTERNAL_ACCOUNT_EMAILS ⇒ no exemption path; the gate sees the real plan.
const ENV = { vars: {} } as never;

beforeEach(() => vi.clearAllMocks());

describe("paywall: a freshly created workspace cannot build (no free capacity)", () => {
	it("provisions plan=none, then POST /projects 402s subscription_required and inserts nothing", async () => {
		const sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		sqlite.exec(
			`INSERT INTO user (id,name,email) VALUES ('u1','U1','u1@x.io')`,
		);

		const proxy = makeProxy(sqlite);
		vi.mocked(db).mockReturnValue(proxy as never);

		// Create the workspace exactly like POST /api/workspaces does.
		const ws = await provisionWorkspace(proxy as never, "u1", "Fresh");

		// Sanity: the new workspace really is unpaid (schema default).
		const planRow = sqlite
			.prepare(`SELECT plan FROM workspace WHERE id = ?`)
			.get(ws.id) as { plan: string };
		expect(planRow.plan).toBe("none");

		// The owner of this brand-new workspace tries to build a project.
		const res = await projects.request(
			"/projects",
			{
				method: "POST",
				headers: {
					"x-test-user": "u1",
					"x-workspace-id": ws.id,
					"content-type": "application/json",
				},
				body: JSON.stringify({ name: "Bot" }),
			},
			ENV,
		);

		// Hard server-side paywall — owner role is fine, but no subscription ⇒ 402.
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({ error: "subscription_required" });

		// Nothing was created — creating a workspace bought zero build capacity.
		const projectCount = (
			sqlite.prepare(`SELECT count(*) AS n FROM project`).get() as { n: number }
		).n;
		expect(projectCount).toBe(0);
	});
});
