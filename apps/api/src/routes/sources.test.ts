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

// Generic authed POST for the manual-source routes (text/qa), mirroring
// `promote` but path-agnostic. Admin role + selected workspace by default.
function post(
	path: string,
	body: unknown,
	headers: Record<string, string> = {},
) {
	return sources.request(
		path,
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

// Admin-only manual authoring of url-less sources. Project ∈ workspace; no
// tenant chain to a message (these aren't promoted), so the state is minimal.
const authoringState: State = {
	role: "admin",
	project: { id: "p1", workspaceId: "ws_1" },
};

describe("POST /sources/text — manual text snippet", () => {
	it("creates a text source (kind=text, url=null, content trimmed, title derived)", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/text", {
			content: "  We restock on Mondays.  ",
		});
		expect(res.status).toBe(200);
		const json = (await res.json()) as { source: Record<string, unknown> };
		expect(json.source).toMatchObject({ kind: "text", url: null });
		expect(lastInsert).toMatchObject({
			projectId: "p1",
			kind: "text",
			url: null,
			content: "We restock on Mondays.",
			active: true,
		});
		// Title derives from the snippet body when no override is sent.
		expect(lastInsert?.title).toBe("We restock on Mondays.");
	});

	it("honors a title override", async () => {
		mockDb(authoringState);
		await post("/projects/p1/sources/text", {
			title: "Restock cadence",
			content: "Mondays.",
		});
		expect(lastInsert?.title).toBe("Restock cadence");
	});

	it("400s empty content (schema min); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/text", { content: "" });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s whitespace-only content (trim guard); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/text", { content: "   " });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("403s an agent (admin-only authoring); never inserts", async () => {
		mockDb({ ...authoringState, role: "agent" });
		const res = await post("/projects/p1/sources/text", { content: "x" });
		expect(res.status).toBe(403);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("404s when the project isn't in the caller's workspace; never inserts", async () => {
		mockDb({ ...authoringState, project: undefined });
		const res = await post("/projects/p1/sources/text", { content: "x" });
		expect(res.status).toBe(404);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});

describe("POST /sources/qa — manual Q&A pair", () => {
	it("creates a qa source with no provenance (sourceMessageId=null), trimmed", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", {
			question: "  Do you ship internationally?  ",
			answer: "  Yes, to 40 countries.  ",
		});
		expect(res.status).toBe(200);
		expect(lastInsert).toMatchObject({
			projectId: "p1",
			kind: "qa",
			url: null,
			question: "Do you ship internationally?",
			answer: "Yes, to 40 countries.",
			content: "Q: Do you ship internationally?\nA: Yes, to 40 countries.",
			sourceMessageId: null,
			active: true,
		});
		expect(lastInsert?.title).toBe("Do you ship internationally?");
	});

	it("400s a missing answer (schema required); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", { question: "Q?" });
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("400s a whitespace-only question (trim guard); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", {
			question: "   ",
			answer: "A",
		});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("403s an agent (admin-only); never inserts", async () => {
		mockDb({ ...authoringState, role: "agent" });
		const res = await post("/projects/p1/sources/qa", {
			question: "Q?",
			answer: "A",
		});
		expect(res.status).toBe(403);
		expect(insertSpy).not.toHaveBeenCalled();
	});
});

// Caps, title truncation, and RBAC/workspace edges for the manual routes —
// mirrors of the guards the promote suite already pins, so a future schema
// divergence (widened caps, dropped trim guard) can't slip through untested.
describe("POST /sources/text + /qa — caps, truncation & RBAC edges", () => {
	it("text: 400s content over the 50k cap; never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/text", {
			content: "x".repeat(50_001),
		});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("qa: 400s an over-length question (2k cap); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", {
			question: "x".repeat(2_001),
			answer: "A",
		});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("qa: 400s an over-length answer (8k cap); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", {
			question: "Q?",
			answer: "x".repeat(8_001),
		});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("qa: 400s a whitespace-only answer (trim guard mirrors the question case); never inserts", async () => {
		mockDb(authoringState);
		const res = await post("/projects/p1/sources/qa", {
			question: "Q?",
			answer: "   ",
		});
		expect(res.status).toBe(400);
		expect(insertSpy).not.toHaveBeenCalled();
	});

	it("text: derives the title from content but truncates it to 60 chars (full content kept)", async () => {
		mockDb(authoringState);
		await post("/projects/p1/sources/text", { content: "a".repeat(70) });
		expect((lastInsert!.title as string).length).toBe(60);
		expect((lastInsert!.content as string).length).toBe(70);
	});

	it("text: accepts a long title override (≤200) but stores it truncated to 60", async () => {
		mockDb(authoringState);
		await post("/projects/p1/sources/text", {
			title: "T".repeat(100),
			content: "body",
		});
		expect((lastInsert!.title as string).length).toBe(60);
	});

	it("qa: title is the question sliced to 60, but the full question is stored", async () => {
		mockDb(authoringState);
		const q = "Q".repeat(80);
		await post("/projects/p1/sources/qa", { question: q, answer: "A" });
		expect((lastInsert!.title as string).length).toBe(60);
		expect(lastInsert?.question).toBe(q);
		expect(lastInsert?.content).toBe(`Q: ${q}\nA: A`);
	});

	it("text: an owner passes the admin gate (role hierarchy)", async () => {
		mockDb({ ...authoringState, role: "owner" });
		const res = await post("/projects/p1/sources/text", { content: "hi" });
		expect(res.status).toBe(200);
		expect(insertSpy).toHaveBeenCalledTimes(1);
	});

	it("qa: 400s when no workspace is selected", async () => {
		mockDb(authoringState);
		const res = await sources.request(
			"/projects/p1/sources/qa",
			{
				method: "POST",
				headers: { "x-test-user": "u1", "content-type": "application/json" },
				body: JSON.stringify({ question: "Q?", answer: "A" }),
			},
			ENV,
		);
		expect(res.status).toBe(400);
	});
});
