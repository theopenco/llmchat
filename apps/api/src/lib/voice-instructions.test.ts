import { describe, expect, it } from "vitest";

import {
	assembleVoiceInstructions,
	loadVoiceGrounding,
	VOICE_CALL_STYLE_PROMPT,
	VOICE_TOKEN_CEILING,
} from "./voice-instructions";

import type { Database } from "@llmchat/db";

describe("assembleVoiceInstructions (pure)", () => {
	it("all three estimates agree — and trimmed is false — when nothing is cut", () => {
		const r = assembleVoiceInstructions("be nice", "some knowledge", []);
		expect(r.truncated).toBe(false);
		expect(r.trimmed).toBe(false);
		expect(r.fullEstimatedTokens).toBe(r.estimatedTokens);
		expect(r.contentEstimatedTokens).toBe(r.estimatedTokens);
		expect(r.fullEstimatedTokens).toBeLessThanOrEqual(VOICE_TOKEN_CEILING);
	});

	it("reports the UNTRIMMED estimate when the assembly is over the ceiling", () => {
		// 60k ASCII ≈ 20k estimated tokens — well over the 12,288 ceiling.
		const r = assembleVoiceInstructions("z".repeat(60_000), "", []);
		expect(r.truncated).toBe(true);
		expect(r.trimmed).toBe(true);
		expect(r.fullEstimatedTokens).toBeGreaterThan(VOICE_TOKEN_CEILING);
		expect(r.fullEstimatedTokens).toBeGreaterThan(r.estimatedTokens);
		expect(r.estimatedTokens).toBeLessThanOrEqual(VOICE_TOKEN_CEILING);
	});

	it("the spoken addendum survives truncation whole", () => {
		const r = assembleVoiceInstructions("z".repeat(60_000), "", []);
		expect(r.instructions.endsWith(VOICE_CALL_STYLE_PROMPT)).toBe(true);
	});

	it("hard-slices knowledgeText to the voice budget before assembly", () => {
		const knowledge = "k".repeat(8_000) + "OVERFLOW_MARKER";
		const r = assembleVoiceInstructions("be nice", knowledge, []);
		expect(r.instructions).not.toContain("OVERFLOW_MARKER");
		expect(r.instructions).toContain("k".repeat(8_000));
	});

	it("the knowledge char-slice alone flips trimmed — under the token ceiling", () => {
		// 30k chars ≈ 10k tokens raw: under the ceiling, but sliced to 8k chars.
		const r = assembleVoiceInstructions("be nice", "a".repeat(30_000), []);
		expect(r.truncated).toBe(false);
		expect(r.trimmed).toBe(true);
		expect(r.contentEstimatedTokens).toBeGreaterThan(r.estimatedTokens);
		expect(r.contentEstimatedTokens).toBeLessThan(VOICE_TOKEN_CEILING);
	});

	it("the source even-split alone flips trimmed — under the token ceiling", () => {
		// Two 10k sources = 20k chars against the 16k voice budget → each cut to
		// 8k; raw ≈ 7k tokens, comfortably under the ceiling.
		const sources = [
			{ title: "A", url: "", content: "s".repeat(10_000) },
			{ title: "B", url: "", content: "t".repeat(10_000) },
		];
		const r = assembleVoiceInstructions("be nice", "", sources);
		expect(r.truncated).toBe(false);
		expect(r.trimmed).toBe(true);
		expect(r.contentEstimatedTokens).toBeGreaterThan(r.estimatedTokens);
	});
});

// Minimal fake of the drizzle query API: findFirst/findMany take the where
// callback but the fake decides the result; the source query's where is
// EVALUATED with recording ops so the active-only constraint is pinned.
function fakeDb({
	libraryRow,
	sources = [],
}: {
	libraryRow?: { content: string } | undefined;
	sources?: Record<string, unknown>[];
}) {
	const sourceWherePairs: unknown[][] = [];
	const dbi = {
		query: {
			systemPrompt: { findFirst: async () => libraryRow },
			source: {
				findMany: async (opts: {
					where: (s: unknown, ops: unknown) => unknown;
				}) => {
					opts.where(
						{ projectId: "COL_projectId", active: "COL_active" },
						{
							and: (...xs: unknown[]) => xs,
							eq: (col: unknown, val: unknown) => {
								sourceWherePairs.push([col, val]);
								return [col, val];
							},
						},
					);
					return sources;
				},
			},
		},
	} as unknown as Database;
	return { dbi, sourceWherePairs };
}

describe("loadVoiceGrounding", () => {
	const project = {
		id: "p1",
		systemPrompt: "own prompt",
		activeSystemPromptId: null as string | null,
	};

	it("uses the project's own prompt when no library variant is active", async () => {
		const { dbi } = fakeDb({});
		const g = await loadVoiceGrounding(dbi, project);
		expect(g.promptContent).toBe("own prompt");
	});

	it("the ACTIVE library row overrides the project prompt — exactly like the mint", async () => {
		const { dbi } = fakeDb({ libraryRow: { content: "library prompt" } });
		const g = await loadVoiceGrounding(dbi, {
			...project,
			activeSystemPromptId: "sp1",
		});
		expect(g.promptContent).toBe("library prompt");
	});

	it("falls back to the project prompt when the named library row is gone", async () => {
		const { dbi } = fakeDb({ libraryRow: undefined });
		const g = await loadVoiceGrounding(dbi, {
			...project,
			activeSystemPromptId: "sp_deleted",
		});
		expect(g.promptContent).toBe("own prompt");
	});

	it("queries ACTIVE sources only and maps them to buildSystem's shape", async () => {
		const { dbi, sourceWherePairs } = fakeDb({
			sources: [
				{ title: "Docs", url: "https://x.test/docs", content: "c1" },
				{ title: "", url: "https://x.test/faq", content: "c2" },
				{ title: "Note", url: null, content: "c3" },
			],
		});
		const g = await loadVoiceGrounding(dbi, project);
		expect(sourceWherePairs).toContainEqual(["COL_active", true]);
		expect(g.sources).toEqual([
			{ title: "Docs", url: "https://x.test/docs", content: "c1" },
			{ title: "https://x.test/faq", url: "https://x.test/faq", content: "c2" },
			{ title: "Note", url: "", content: "c3" },
		]);
	});
});
