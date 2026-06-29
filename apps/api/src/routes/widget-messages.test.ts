import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { widgetMessages } from "./widget-messages";

vi.mock("@/lib/db", () => ({ db: vi.fn() }));
vi.mock("@/lib/kv", () => ({
	rateLimit: vi.fn(async () => ({ ok: true })),
	publicLookupRateLimit: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/request", () => ({ clientIp: () => "1.2.3.4" }));

const ENV = { vars: {}, DB: {} } as never;

function mockDb(conv: Record<string, unknown> | null, rows: unknown[] = []) {
	vi.mocked(db).mockReturnValue({
		query: {
			project: { findFirst: async () => ({ id: "p1" }) },
			conversation: { findFirst: async () => conv },
			message: { findMany: async () => rows },
		},
	} as unknown as ReturnType<typeof db>);
}

function getMessages() {
	return widgetMessages.request(
		"/messages?projectKey=pk&clientId=c1",
		{ method: "GET" },
		ENV,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /v1/messages — escalatedAt exposure (Bug 3)", () => {
	it("returns escalatedAt so the widget can hydrate the handoff state on reload", async () => {
		const when = new Date("2026-06-29T00:00:00.000Z");
		mockDb({ id: "c1", csatRating: null, escalatedAt: when });
		const res = await getMessages();
		expect(res.status).toBe(200);
		expect((await res.json()).escalatedAt).toBe(when.toISOString());
	});

	it("returns escalatedAt: null for a non-escalated conversation", async () => {
		mockDb({ id: "c1", csatRating: null, escalatedAt: null });
		expect((await (await getMessages()).json()).escalatedAt).toBeNull();
	});

	it("returns escalatedAt: null in the no-conversation branch (shape stability)", async () => {
		mockDb(null);
		const json = await (await getMessages()).json();
		expect(json.conversationId).toBeNull();
		expect(json.escalatedAt).toBeNull();
	});
});
