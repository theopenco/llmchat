// End-to-end proof of the tenant boundary for workspace-wide ⌘K search.
//
// This is the deliverable: a user in workspace A must NEVER see workspace B's
// conversations, message bodies, or projects — even when the search term
// matches rows in both. conversation/message carry no workspaceId (the IDOR
// footgun), so the test drives the REAL `search` handler against a REAL sqlite
// DB seeded with two tenants and asserts zero cross-tenant bleed across all
// three arms (name/email, message-body two-hop, project), plus the empty-set
// guard and the membership gate.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	conversation,
	member,
	message,
	project,
	schema,
	user,
	workspace,
} from "@llmchat/db";

import type { Env } from "@/env";

// Header-driven fake session: `x-test-user` present ⇒ signed in as that user id.
// Workspace membership is decided by the REAL `member` table via requireWorkspace.
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
import { db } from "@/lib/db";
import { search } from "./search";

// ─── real sqlite (via proxy), shared by the route + the test seeder ─────────
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
	// Two-callback form so the drizzle `casing` option is honored (single-callback
	// form drops it → camelCase SQL against snake_case columns).
	return drizzle(exec, batch, { schema, casing: "snake_case" });
}

const ENV = { vars: {}, DB: {} } as unknown as Env;

function req(userId: string, workspaceId: string, q: string) {
	const params = new URLSearchParams();
	if (q !== undefined) params.set("q", q);
	return search.request(
		`/search?${params.toString()}`,
		{
			headers: {
				"x-test-user": userId,
				"x-workspace-id": workspaceId,
			},
		},
		ENV,
	);
}

type SearchBody = {
	conversations: {
		id: string;
		projectId: string;
		projectName: string;
		name: string | null;
		email: string | null;
		match: { field: "body" | "name" | "email"; snippet: string };
	}[];
	projects: { id: string; name: string }[];
};

// ── Identity / tenant fixture. userA owns workspace A and (empty) workspace C;
// userB owns workspace B. Both A and B hold a project + conversations whose
// content collides on the search terms, so any missing scope leaks across. ──
const userA = "user-a";
const userB = "user-b";
const wsA = "ws-a";
const wsB = "ws-b";
const wsC = "ws-c-empty";
const pA = "proj-a";
const pB = "proj-b";

async function seed(sqlite: DatabaseSync) {
	const sdb = makeProxy(sqlite);

	await sdb.insert(user).values([
		{ id: userA, name: "Owner A", email: "a@example.com" },
		{ id: userB, name: "Owner B", email: "b@example.com" },
	]);
	await sdb.insert(workspace).values([
		{ id: wsA, name: "Workspace A", ownerId: userA },
		{ id: wsB, name: "Workspace B", ownerId: userB },
		{ id: wsC, name: "Workspace C (no projects)", ownerId: userA },
	]);
	await sdb.insert(member).values([
		{ id: "m-a", workspaceId: wsA, userId: userA, role: "owner" },
		{ id: "m-b", workspaceId: wsB, userId: userB, role: "owner" },
		{ id: "m-c", workspaceId: wsC, userId: userA, role: "owner" },
	]);
	// Both project names contain "support" → a project-arm leak would surface pB.
	await sdb.insert(project).values([
		{
			id: pA,
			workspaceId: wsA,
			name: "Acme Support",
			publicKey: "pk_a",
			inboundEmailLocal: "inbound_a",
		},
		{
			id: pB,
			workspaceId: wsB,
			name: "Beta Support",
			publicKey: "pk_b",
			inboundEmailLocal: "inbound_b",
		},
	]);
	// Visitor name/email collide on "alice"; bodies collide on "refund". Workspace
	// B's rows must never appear for userA.
	await sdb.insert(conversation).values([
		{
			id: "cA-name",
			projectId: pA,
			clientId: "ca1",
			name: "Alice Acme",
			email: "alice@acme.test",
		},
		{
			id: "cA-body",
			projectId: pA,
			clientId: "ca2",
			name: "Bob",
			email: "bob@acme.test",
		},
		{
			id: "cB-name",
			projectId: pB,
			clientId: "cb1",
			name: "Alice Beta",
			email: "alice@beta.test",
		},
		{
			id: "cB-body",
			projectId: pB,
			clientId: "cb2",
			name: "Carol",
			email: "carol@beta.test",
		},
	]);
	await sdb.insert(message).values([
		{
			id: "mA1",
			conversationId: "cA-name",
			role: "user",
			content: "hi there",
			sequence: 1,
		},
		{
			id: "mA2",
			conversationId: "cA-body",
			role: "user",
			content: "I need a refund please",
			sequence: 1,
		},
		{
			id: "mB1",
			conversationId: "cB-name",
			role: "user",
			content: "hello",
			sequence: 1,
		},
		{
			id: "mB2",
			conversationId: "cB-body",
			role: "user",
			content: "refund now please",
			sequence: 1,
		},
	]);
}

describe("workspace-wide ⌘K search — tenant boundary", () => {
	let sqlite: DatabaseSync;
	beforeEach(async () => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
		await seed(sqlite);
	});

	it("name/email arm: a workspace-A user searching 'alice' never sees workspace B's conversation", async () => {
		const res = await req(userA, wsA, "alice");
		expect(res.status).toBe(200);
		const body = (await res.json()) as SearchBody;
		const ids = body.conversations.map((c) => c.id);
		expect(ids).toContain("cA-name");
		// The cross-tenant row (same visitor name "Alice") must be absent.
		expect(ids).not.toContain("cB-name");
		expect(body.conversations.every((c) => c.projectId === pA)).toBe(true);
	});

	it("message-body arm (two-hop): searching 'refund' returns only A's body match, never B's", async () => {
		const res = await req(userA, wsA, "refund");
		expect(res.status).toBe(200);
		const body = (await res.json()) as SearchBody;
		const ids = body.conversations.map((c) => c.id);
		expect(ids).toContain("cA-body");
		expect(ids).not.toContain("cB-body");
		const hit = body.conversations.find((c) => c.id === "cA-body");
		expect(hit?.match.field).toBe("body");
		expect(hit?.match.snippet.toLowerCase()).toContain("refund");
		// The cross-project name-join resolves for a body-only match too.
		expect(hit?.projectName).toBe("Acme Support");
	});

	it("project arm: searching 'support' returns only A's project, never B's", async () => {
		const res = await req(userA, wsA, "support");
		const body = (await res.json()) as SearchBody;
		const pids = body.projects.map((p) => p.id);
		expect(pids).toContain(pA);
		expect(pids).not.toContain(pB);
	});

	it("the SAME term from workspace B returns B's rows and none of A's (mirror direction)", async () => {
		const res = await req(userB, wsB, "alice");
		const body = (await res.json()) as SearchBody;
		const ids = body.conversations.map((c) => c.id);
		expect(ids).toContain("cB-name");
		expect(ids).not.toContain("cA-name");
	});

	it("empty-set guard: a member of a workspace with NO projects gets empty results, not all rows and not a 500", async () => {
		const res = await req(userA, wsC, "alice");
		expect(res.status).toBe(200);
		const body = (await res.json()) as SearchBody;
		expect(body.conversations).toEqual([]);
		expect(body.projects).toEqual([]);
	});

	it("membership gate: a user cannot search a workspace they don't belong to (403)", async () => {
		// userB is NOT a member of workspace A — a forged x-workspace-id can't pivot.
		const res = await req(userB, wsA, "alice");
		expect(res.status).toBe(403);
	});
});

describe("workspace-wide ⌘K search — matching, caps, honesty rail", () => {
	let sqlite: DatabaseSync;
	beforeEach(async () => {
		sqlite = new DatabaseSync(":memory:");
		applyMigrations(sqlite);
		vi.mocked(db).mockReturnValue(makeProxy(sqlite) as never);
		await seed(sqlite);
	});

	it("matches a conversation by visitor name and reports the matched field", async () => {
		const res = await req(userA, wsA, "alice");
		const body = (await res.json()) as SearchBody;
		const hit = body.conversations.find((c) => c.id === "cA-name");
		expect(hit).toBeTruthy();
		expect(hit?.match.field).toBe("name");
		expect(hit?.projectName).toBe("Acme Support");
	});

	it("matches a conversation by visitor email", async () => {
		const res = await req(userA, wsA, "acme.test");
		const body = (await res.json()) as SearchBody;
		const ids = body.conversations.map((c) => c.id).sort();
		// Both A conversations use @acme.test addresses.
		expect(ids).toEqual(["cA-body", "cA-name"]);
		expect(body.conversations.every((c) => c.match.field === "email")).toBe(
			true,
		);
	});

	it("never returns project secrets — only id + name", async () => {
		const res = await req(userA, wsA, "acme");
		const body = (await res.json()) as SearchBody;
		const p = body.projects.find((x) => x.id === pA);
		expect(p).toBeTruthy();
		// The result object carries no config/secret columns.
		expect(Object.keys(p!).sort()).toEqual(["id", "name"]);
	});

	it("honesty rail: a sub-2-char term returns empty without scanning", async () => {
		for (const term of ["", " ", "a"]) {
			const res = await req(userA, wsA, term);
			expect(res.status).toBe(200);
			const body = (await res.json()) as SearchBody;
			expect(body.conversations).toEqual([]);
			expect(body.projects).toEqual([]);
		}
	});

	it("honesty rail: a term with no matches returns empty arrays (never fabricated rows)", async () => {
		const res = await req(userA, wsA, "zzzznomatch");
		const body = (await res.json()) as SearchBody;
		expect(body.conversations).toEqual([]);
		expect(body.projects).toEqual([]);
	});

	it("enforces the per-entity conversation cap (8)", async () => {
		// Seed 12 more matching conversations in A's project; the cap must hold.
		const sdb = makeProxy(sqlite);
		await sdb.insert(conversation).values(
			Array.from({ length: 12 }, (_, i) => ({
				id: `cap-${i}`,
				projectId: pA,
				clientId: `cap-${i}`,
				name: `Zeta Customer ${i}`,
				email: null,
			})),
		);
		const res = await req(userA, wsA, "zeta");
		const body = (await res.json()) as SearchBody;
		expect(body.conversations.length).toBe(8);
		expect(body.conversations.every((c) => c.projectId === pA)).toBe(true);
	});
});
