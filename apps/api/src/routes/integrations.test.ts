import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { integrations, integrationsPublic } from "./integrations";

// Header-driven fake session (matches projects/sources tests): `x-test-user`
// ⇒ signed in; the membership role drives requireRole.
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
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
}));

type Row = Record<string, unknown>;

interface State {
	role?: "owner" | "admin" | "agent";
	project?: Row;
	rows: Row[];
	upserts: Row[];
	deletes: number;
	patches: Row[];
}

function mockDb(state: State) {
	const fake = {
		query: {
			member: {
				findFirst: async () => (state.role ? { role: state.role } : undefined),
			},
			project: { findFirst: async () => state.project },
			integration: { findMany: async () => state.rows },
		},
		insert: () => ({
			values: (vals: Row) => ({
				onConflictDoUpdate: async (opts: { set: Row }) => {
					state.upserts.push({ ...vals, __set: opts.set });
				},
			}),
		}),
		update: () => ({
			set: (vals: Row) => ({
				where: () => ({
					returning: async () => {
						state.patches.push(vals);
						return state.rows.length ? [{ id: "i1" }] : [];
					},
				}),
			}),
		}),
		delete: () => ({
			where: async () => {
				state.deletes += 1;
			},
		}),
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

function seed(overrides: Partial<State> = {}): State {
	return mockDb({
		role: "admin",
		project: { id: "p1", workspaceId: "ws_1" },
		rows: [],
		upserts: [],
		deletes: 0,
		patches: [],
		...overrides,
	});
}

/** In-memory STATE binding (get/set only — mirrors the deployed surface). */
function fakeState() {
	const store = new Map<string, string>();
	return {
		store,
		get: async (k: string) => store.get(k) ?? null,
		set: async (k: string, v: string) => void store.set(k, v),
	};
}

const STATE = fakeState();
const ENV = { vars: {}, DB: {}, STATE } as unknown as Parameters<
	typeof integrations.request
>[2];

const AUTH_HEADERS = {
	"x-test-user": "u1",
	"x-workspace-id": "ws_1",
	"content-type": "application/json",
};

const CAL_CONFIG = { apiKey: "cal_live_123", eventTypeId: 42, timeZone: "UTC" };

function put(kind: string, body: unknown, headers = AUTH_HEADERS) {
	return integrations.request(
		`/projects/p1/integrations/${kind}`,
		{ method: "PUT", headers, body: JSON.stringify(body) },
		ENV,
	);
}

beforeEach(() => {
	STATE.store.clear();
});

describe("PUT /projects/:id/integrations/:kind", () => {
	it("stores a valid calcom config (validated + serialized)", async () => {
		const state = seed();
		const res = await put("calcom", { enabled: true, config: CAL_CONFIG });
		expect(res.status).toBe(200);
		expect(state.upserts).toHaveLength(1);
		expect(JSON.parse(state.upserts[0]!.config as string)).toMatchObject({
			apiKey: "cal_live_123",
			eventTypeId: 42,
		});
	});

	it("rejects an invalid config with a field-specific 400", async () => {
		const state = seed();
		const res = await put("calcom", {
			enabled: true,
			config: { apiKey: "cal_x_1", eventTypeId: -5 },
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { code: string; error: string };
		expect(body.code).toBe("invalid_config");
		expect(body.error).toContain("eventTypeId");
		expect(state.upserts).toHaveLength(0);
	});

	it("rejects unknown kinds", async () => {
		seed();
		const res = await put("zapier", { enabled: true, config: {} });
		expect(res.status).toBe(400);
	});

	it("requires the admin role", async () => {
		seed({ role: "agent" });
		const res = await put("calcom", { enabled: true, config: CAL_CONFIG });
		expect(res.status).toBe(403);
	});

	it("404s on a project outside the workspace", async () => {
		seed({ project: undefined });
		const res = await put("calcom", { enabled: true, config: CAL_CONFIG });
		expect(res.status).toBe(404);
	});
});

describe("GET /projects/:id/integrations", () => {
	it("returns the masked view — raw credentials never leave the server", async () => {
		seed({
			rows: [
				{
					kind: "calcom",
					enabled: true,
					config: JSON.stringify(CAL_CONFIG),
					updatedAt: new Date(1_780_000_000_000),
				},
			],
		});
		const res = await integrations.request(
			"/projects/p1/integrations",
			{ headers: AUTH_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).not.toContain("cal_live_123");
		const body = JSON.parse(text) as {
			integrations: { kind: string; summary: string; secretHint: string }[];
		};
		expect(body.integrations[0]).toMatchObject({
			kind: "calcom",
			summary: "event type 42 · UTC",
			secretHint: "••••_123",
		});
	});
});

describe("PATCH + DELETE", () => {
	it("toggles enabled without touching credentials", async () => {
		const state = seed({
			rows: [{ id: "i1", kind: "calcom" }],
		});
		const res = await integrations.request(
			"/projects/p1/integrations/calcom",
			{
				method: "PATCH",
				headers: AUTH_HEADERS,
				body: JSON.stringify({ enabled: false }),
			},
			ENV,
		);
		expect(res.status).toBe(200);
		expect(state.patches[0]).toMatchObject({ enabled: false });
	});

	it("deletes an integration", async () => {
		const state = seed();
		const res = await integrations.request(
			"/projects/p1/integrations/shopify",
			{ method: "DELETE", headers: AUTH_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		expect(state.deletes).toBe(1);
	});
});

describe("shopify connect-code pairing", () => {
	async function mintCode(): Promise<string> {
		const res = await integrations.request(
			"/projects/p1/integrations/shopify/connect-code",
			{ method: "POST", headers: AUTH_HEADERS },
			ENV,
		);
		expect(res.status).toBe(200);
		return ((await res.json()) as { code: string }).code;
	}

	function register(body: unknown) {
		return integrationsPublic.request(
			"/integrations/shopify/register",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			},
			ENV,
		);
	}

	it("a minted code registers shop credentials exactly once", async () => {
		const state = seed();
		const code = await mintCode();
		const res = await register({
			code,
			shopDomain: "Acme.myshopify.com",
			accessToken: "shpat_abc",
		});
		expect(res.status).toBe(200);
		expect(state.upserts).toHaveLength(1);
		expect(JSON.parse(state.upserts[0]!.config as string)).toMatchObject({
			shopDomain: "acme.myshopify.com",
			accessToken: "shpat_abc",
		});

		// Replay: the code is consumed.
		const replay = await register({
			code,
			shopDomain: "evil.myshopify.com",
			accessToken: "shpat_evil",
		});
		expect(replay.status).toBe(404);
		expect(state.upserts).toHaveLength(1);
	});

	it("rejects unknown and expired codes", async () => {
		seed();
		expect(
			(
				await register({
					code: "nope-nope-nope",
					shopDomain: "a.myshopify.com",
					accessToken: "shpat_x",
				})
			).status,
		).toBe(404);

		const code = await mintCode();
		const key = `shopify-connect:${code}`;
		const stored = JSON.parse(STATE.store.get(key)!) as { expiresAt: number };
		STATE.store.set(
			key,
			JSON.stringify({ ...stored, expiresAt: stored.expiresAt - 10_000 }),
		);
		expect(
			(
				await register({
					code,
					shopDomain: "a.myshopify.com",
					accessToken: "shpat_x",
				})
			).status,
		).toBe(404);
	});

	it("rejects a non-myshopify domain", async () => {
		seed();
		const code = await mintCode();
		const res = await register({
			code,
			shopDomain: "phishing.example.com",
			accessToken: "shpat_x",
		});
		expect(res.status).toBe(400);
	});
});
