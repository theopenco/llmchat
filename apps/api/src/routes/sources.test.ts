import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";

import { sources } from "./sources";

// Header-driven fake session (matches projects.test.ts): `x-test-user` ⇒ signed
// in; the membership role drives requireRole.
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

// fetch-url is only hit by the URL-source routes, never by promote — stub it so
// an accidental network call can't leak into these tests.
vi.mock("@/lib/fetch-url", () => ({
	fetchUrlContent: vi.fn(async () => ({ title: "", content: "" })),
}));

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof sources.request
>[2];

interface State {
	role?: "owner" | "admin" | "agent";
	/** ensureProject result (project ∈ workspace). undefined ⇒ 404. */
	project?: Record<string, unknown>;
	/** First message.findFirst (the message being promoted). */
	message?: Record<string, unknown>;
	/** conversation.findFirst result. */
	conversation?: Record<string, unknown>;
	/** Existing qa source with this sourceMessageId (dedupe). */
	existingSource?: Record<string, unknown>;
	/** Second message.findFirst (nearest preceding visitor message). */
	precedingVisitor?: Record<string, unknown>;
}

let insertSpy: ReturnType<typeof vi.fn>;
/** The values object handed to insert(source).values(...) on the last promote. */
let lastInsert: Record<string, unknown> | null;

function mockDb(state: State) {
	lastInsert = null;
	insertSpy = vi.fn(() => ({
		values: (data: Record<string, unknown>) => {
			lastInsert = data;
			return { returning: async () => [{ id: "src_new", ...data }] };
		},
	}));
	// message.findFirst is called up to twice: first the target message, then the
	// preceding visitor message (only when no question override was sent).
	let msgCall = 0;
	const fake = {
		query: {
			member: {
				findFirst: async () => (state.role ? { role: state.role } : undefined),
			},
			project: {
				findFirst: async () => state.project,
			},
			message: {
				findFirst: async () => {
					msgCall += 1;
					return msgCall === 1 ? state.message : state.precedingVisitor;
				},
			},
			conversation: {
				findFirst: async () => state.conversation,
			},
			source: {
				findFirst: async () => state.existingSource,
				findMany: async () => [],
			},
		},
		insert: insertSpy,
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
	return state;
}

function promote(body: unknown, headers: Record<string, string> = {}) {
	return sources.request(
		"/projects/p1/sources/promote",
		{
			method: "POST",
			headers: {
				"x-test-user": "u1",
				"x-workspace-id": "ws_1",
				"content-type": "application/json",
				...headers,
			},
			body: JSON.stringify(body),
		},
		ENV,
	);
}

// A conversation that belongs to project p1 (the happy-path tenant chain).
const okState: State = {
	role: "agent",
	project: { id: "p1", workspaceId: "ws_1" },
	message: {
		id: "m2",
		conversationId: "c1",
		role: "admin",
		content: "Click the reset link in settings.",
		sequence: 4,
	},
	conversation: { id: "c1", projectId: "p1" },
	precedingVisitor: {
		id: "m1",
		conversationId: "c1",
		role: "user",
		content: "How do I reset my password?",
		sequence: 3,
	},
};

beforeEach(() => vi.clearAllMocks());

describe("POST /sources/promote — happy path", () => {
	it("promotes a reply into a qa source (kind=qa, url=null, provenance set)", async () => {
		mockDb(okState);
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(200);
		const json = (await res.json()) as { source: Record<string, unknown> };
		expect(json.source).toMatchObject({ kind: "qa", url: null });
		expect(lastInsert).toMatchObject({
			projectId: "p1",
			kind: "qa",
			url: null,
			sourceMessageId: "m2",
			active: true,
			question: "How do I reset my password?",
			answer: "Click the reset link in settings.",
			content:
				"Q: How do I reset my password?\nA: Click the reset link in settings.",
		});
		// Title is the first chars of the question.
		expect(lastInsert?.title).toBe("How do I reset my password?");
	});

	it("derives the answer from the message body when no override is sent", async () => {
		mockDb(okState);
		await promote({ messageId: "m2" });
		expect(lastInsert?.answer).toBe("Click the reset link in settings.");
	});

	it("honors question + answer overrides", async () => {
		mockDb(okState);
		await promote({
			messageId: "m2",
			question: "Reset password?",
			answer: "Go to Settings → Security → Reset.",
		});
		expect(lastInsert).toMatchObject({
			question: "Reset password?",
			answer: "Go to Settings → Security → Reset.",
			content: "Q: Reset password?\nA: Go to Settings → Security → Reset.",
		});
	});
});

describe("POST /sources/promote — tenant isolation", () => {
	it("404s a messageId whose conversation is in another project; never inserts", async () => {
		// Cross-tenant: caller owns p1, message m2 belongs to conversation in p_other.
		mockDb({
			...okState,
			conversation: { id: "c1", projectId: "p_other" },
		});
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s when the project isn't in the caller's workspace; never inserts", async () => {
		mockDb({ ...okState, project: undefined });
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s when the message doesn't exist; never inserts", async () => {
		mockDb({ ...okState, message: undefined });
		const res = await promote({ messageId: "missing" });
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});

describe("POST /sources/promote — RBAC", () => {
	it("allows an agent (minimum role)", async () => {
		mockDb({ ...okState, role: "agent" });
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(200);
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("403s a non-member; never inserts", async () => {
		mockDb({ ...okState, role: undefined });
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(403);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s when no workspace is selected", async () => {
		mockDb(okState);
		const res = await sources.request(
			"/projects/p1/sources/promote",
			{
				method: "POST",
				headers: { "x-test-user": "u1", "content-type": "application/json" },
				body: JSON.stringify({ messageId: "m2" }),
			},
			ENV,
		);
		expect(res.status).toBe(400);
	});
});

describe("POST /sources/promote — defaults & validation", () => {
	it("handles a conversation with no preceding visitor message (empty question)", async () => {
		mockDb({ ...okState, precedingVisitor: undefined });
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(200);
		expect(lastInsert?.question).toBe("");
		expect(lastInsert?.content).toBe(
			"Q: \nA: Click the reset link in settings.",
		);
		// Title falls back to the answer when the question is empty.
		expect(lastInsert?.title).toBe("Click the reset link in settings.");
	});

	it("400s a whitespace-only answer override; never inserts", async () => {
		mockDb(okState);
		const res = await promote({ messageId: "m2", answer: "   " });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s when the derived answer (empty message body) is blank; never inserts", async () => {
		mockDb({
			...okState,
			message: {
				id: "m2",
				conversationId: "c1",
				role: "admin",
				content: "   ",
				sequence: 4,
			},
		});
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s an over-length question (schema cap); never inserts", async () => {
		mockDb(okState);
		const res = await promote({ messageId: "m2", question: "x".repeat(2001) });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s an over-length answer (schema cap); never inserts", async () => {
		mockDb(okState);
		const res = await promote({ messageId: "m2", answer: "x".repeat(8001) });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s a missing messageId (required field); never inserts", async () => {
		mockDb(okState);
		const res = await promote({});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});

describe("POST /sources/promote — dedupe", () => {
	it("returns the existing source and does NOT insert a duplicate", async () => {
		mockDb({
			...okState,
			existingSource: { id: "src_old", kind: "qa", sourceMessageId: "m2" },
		});
		const res = await promote({ messageId: "m2" });
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			source: { id: string };
			deduped?: boolean;
		};
		expect(json.source.id).toBe("src_old");
		expect(json.deduped).toBe(true);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});
