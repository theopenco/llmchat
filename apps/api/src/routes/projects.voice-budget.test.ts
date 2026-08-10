import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import {
	assembleVoiceInstructions,
	VOICE_TOKEN_CEILING,
} from "@/lib/voice-instructions";

import { projects } from "./projects";

// Header-driven fake session so requireSession/requireWorkspace run for real
// without standing up Better Auth (same rig as projects.test.ts).
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

const ENV = { vars: {}, DB: {} } as unknown as Parameters<
	typeof projects.request
>[2];

interface State {
	/** The project row the workspace-scoped lookup resolves, or undefined. */
	project?: Record<string, unknown>;
	/** The active system-prompt library row, when one is queried. */
	libraryRow?: { content: string };
	sources?: Record<string, unknown>[];
}

/** [column-marker, value] pairs the voice-budget project lookup constrained —
 * lets a test pin that BOTH the id AND the workspace are in the WHERE (the
 * IDOR guard), which a result-only mock could never see. */
let projectWherePairs: unknown[][];

function mockDb(state: State) {
	projectWherePairs = [];
	const fake = {
		query: {
			member: {
				findFirst: async () => ({ role: "owner" }),
			},
			project: {
				findFirst: async (opts: {
					where: (pt: unknown, ops: unknown) => unknown;
				}) => {
					opts.where(
						{ id: "COL_id", workspaceId: "COL_workspaceId" },
						{
							and: (...xs: unknown[]) => xs,
							eq: (col: unknown, val: unknown) => {
								projectWherePairs.push([col, val]);
								return [col, val];
							},
						},
					);
					return state.project;
				},
			},
			systemPrompt: { findFirst: async () => state.libraryRow },
			source: { findMany: async () => state.sources ?? [] },
		},
	};
	vi.mocked(db).mockReturnValue(fake as unknown as ReturnType<typeof db>);
}

function request(projectId = "p1") {
	return projects.request(
		`/projects/${projectId}/voice-budget`,
		{ headers: { "x-test-user": "u1", "x-workspace-id": "ws_1" } },
		ENV,
	);
}

const baseProject = {
	id: "p1",
	workspaceId: "ws_1",
	systemPrompt: "be nice",
	activeSystemPromptId: null,
	knowledgeText: "",
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /projects/:projectId/voice-budget (#182)", () => {
	it("404s when the project doesn't resolve in this workspace", async () => {
		mockDb({ project: undefined });
		const res = await request("p_other");
		expect(res.status).toBe(404);
	});

	it("constrains the lookup by BOTH project id and workspace — the IDOR guard", async () => {
		mockDb({ project: baseProject });
		await request();
		expect(projectWherePairs).toContainEqual(["COL_id", "p1"]);
		expect(projectWherePairs).toContainEqual(["COL_workspaceId", "ws_1"]);
	});

	it("estimates from the ACTIVE library prompt, not the project's stale field", async () => {
		// The project's own prompt is tiny; the active library variant is what a
		// call actually ships. A client-side estimate from the projects cache
		// would get exactly this wrong — the row's content isn't in it.
		mockDb({
			project: { ...baseProject, activeSystemPromptId: "sp1" },
			libraryRow: { content: "X".repeat(30_000) },
		});
		const res = await request();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { estimatedTokens: number };
		// 30k ASCII ≈ 10k estimated tokens; the tiny fallback prompt would sit
		// under a few hundred.
		expect(body.estimatedTokens).toBeGreaterThan(9_000);
	});

	it("reports the RAW content estimate — the mint's 8k knowledge slice must not hide the overflow", async () => {
		// This is #182's whole point: an operator with 100k chars of knowledge
		// gets a silently sliced voice KB. The hint must see the full content
		// (>33k estimated tokens), not the post-slice assembly (<5k) — measuring
		// after the slice would never fire for exactly this operator.
		mockDb({
			project: { ...baseProject, knowledgeText: "a".repeat(100_000) },
		});
		const res = await request();
		const body = (await res.json()) as {
			estimatedTokens: number;
			trimmed: boolean;
		};
		expect(body.estimatedTokens).toBeGreaterThan(33_000);
		expect(body.trimmed).toBe(true);
	});

	it("reports trimmed=true for a char-sliced knowledge base even UNDER the token ceiling", async () => {
		// 30k chars ≈ 10k estimated tokens — under the 12,288 ceiling, but the
		// 8k char slice still cuts it. The trim signal must not depend on the
		// token ceiling alone.
		mockDb({
			project: { ...baseProject, knowledgeText: "a".repeat(30_000) },
		});
		const res = await request();
		const body = (await res.json()) as {
			estimatedTokens: number;
			ceiling: number;
			trimmed: boolean;
		};
		expect(body.trimmed).toBe(true);
		expect(body.estimatedTokens).toBeLessThan(body.ceiling);
	});

	it("reports trimmed=true with the raw estimate when over the token ceiling", async () => {
		mockDb({
			project: { ...baseProject, systemPrompt: "z".repeat(60_000) },
		});
		const res = await request();
		const body = (await res.json()) as {
			estimatedTokens: number;
			ceiling: number;
			trimmed: boolean;
		};
		expect(body.trimmed).toBe(true);
		expect(body.ceiling).toBe(VOICE_TOKEN_CEILING);
		expect(body.estimatedTokens).toBeGreaterThan(VOICE_TOKEN_CEILING);
	});

	it("agrees exactly with the mint's own assembly on the same inputs", async () => {
		const project = {
			...baseProject,
			systemPrompt: "answer from the docs",
			knowledgeText: "k".repeat(12_000),
		};
		const sources = [
			{ title: "Docs", url: "https://x.test/d", content: "s".repeat(9_000) },
		];
		mockDb({ project, sources });
		const res = await request();
		const body = (await res.json()) as {
			estimatedTokens: number;
			trimmed: boolean;
		};
		const direct = assembleVoiceInstructions(
			project.systemPrompt,
			project.knowledgeText,
			sources.map((s) => ({ title: s.title, url: s.url, content: s.content })),
		);
		expect(body.estimatedTokens).toBe(direct.contentEstimatedTokens);
		expect(body.trimmed).toBe(direct.trimmed);
	});
});
