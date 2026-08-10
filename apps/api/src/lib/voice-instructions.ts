import { buildSystem } from "@/lib/llm";

import type { Database } from "@llmchat/db";

/**
 * Voice instruction assembly — ONE implementation with TWO callers:
 *
 *   1. the mint (`POST /v1/voice/session` in routes/voice.ts), which ships the
 *      result to the realtime session, and
 *   2. the dashboard's budget hint (`GET /api/projects/:id/voice-budget` in
 *      routes/projects.ts, #182), which shows the operator the same numbers.
 *
 * That sharing is the point: the hint reuses the mint's own estimator and
 * assembly, so it can never disagree with what a call actually gets. Anything
 * moved or changed here changes BOTH surfaces together.
 */

// --- Voice instruction budget -----------------------------------------------
//
// The realtime API hard-caps session instructions (+ tools) at 16,384 tokens;
// an oversized session.update is REJECTED upstream and the call would run
// ungrounded. The text path's budgets (80k source chars, uncapped knowledge)
// were sized for 128k-context chat models and blow straight through that cap,
// which is exactly the bug this bounds out: the mint must NEVER ship
// instructions it expects the session to reject.
//
// Layer 1 — voice-sized budgets. Sources reuse buildSystem's even-split
// discipline with a smaller constant; knowledgeText (uncapped on the text
// path) gets a hard slice here.
const VOICE_MAX_SOURCES_CHARS = 16_000;
const VOICE_MAX_KNOWLEDGE_CHARS = 8_000;
// Layer 2 — the by-construction guarantee. Estimated instruction tokens must
// clear this ceiling or the assembled prompt is truncated server-side before
// it ships: 12,288 = 75% of the upstream 16,384 cap, a 4,096-token margin for
// estimator error. The estimator is worst-case-biased (see below), so typical
// Latin-script prompts sit far beneath the real cap.
export const VOICE_TOKEN_CEILING = 12_288;

/**
 * Worst-case-biased token estimate for realtime instructions: ASCII at 3
 * chars/token — NOT the usual prose average of ~4, because operator content
 * is often token-dense ASCII (hex ids, base64 blobs, code, numeric tables)
 * that real BPE tokenizers price at ~2-3 chars/token — and every non-ASCII
 * code unit counted as a FULL token (CJK really does approach 1 token/char).
 * Overestimating costs a shorter KB; underestimating ships an update the
 * upstream rejects. Content denser than 2.25 chars/token (36,864 chars at
 * the 12,288 ceiling vs the real 16,384 cap) can still slip past — and then
 * fails CLOSED in the widget (terminal "unavailable"), never ungrounded.
 * Pure.
 */
export function estimateRealtimeTokens(text: string): number {
	let ascii = 0;
	let wide = 0;
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) <= 0x7f) ascii++;
		else wide++;
	}
	return Math.ceil(ascii / 3) + wide;
}

/**
 * Bound assembled voice instructions to VOICE_TOKEN_CEILING. The spoken-style
 * addendum ALWAYS survives whole (it's what makes the call sound like a call);
 * when the estimate is over the ceiling, the base prompt (scaffold + operator
 * prompt + KB) is cut at the exact prefix whose estimated tokens fit the
 * remainder — a single deterministic left-to-right walk, so the same input
 * always yields the same output. Pure; the caller logs the (content-free)
 * truncation counter.
 */
export function boundVoiceInstructions(
	base: string,
	addendum: string,
): { instructions: string; truncated: boolean; estimatedTokens: number } {
	const joined = `${base}\n\n${addendum}`;
	const total = estimateRealtimeTokens(joined);
	if (total <= VOICE_TOKEN_CEILING) {
		return { instructions: joined, truncated: false, estimatedTokens: total };
	}
	const reserved = estimateRealtimeTokens(`\n\n${addendum}`);
	const budget = VOICE_TOKEN_CEILING - reserved;
	// Walk the base one code unit at a time, recomputing the estimator's own
	// integer arithmetic (ceil(ascii/3) + wide) on running counts — exact
	// agreement with estimateRealtimeTokens by construction, no accumulated
	// float drift.
	let ascii = 0;
	let wide = 0;
	let end = 0;
	while (end < base.length) {
		const isAscii = base.charCodeAt(end) <= 0x7f;
		const next =
			Math.ceil((ascii + (isAscii ? 1 : 0)) / 3) + wide + (isAscii ? 0 : 1);
		if (next > budget) break;
		if (isAscii) ascii++;
		else wide++;
		end++;
	}
	// Never cut between the halves of a surrogate pair — a trailing lone high
	// surrogate is ill-formed Unicode, and strict JSON parsers upstream reject
	// the whole session.update that carries it.
	const lastKept = end > 0 ? base.charCodeAt(end - 1) : 0;
	if (lastKept >= 0xd800 && lastKept <= 0xdbff) end--;
	const instructions = `${base.slice(0, end)}\n\n${addendum}`;
	return {
		instructions,
		truncated: true,
		estimatedTokens: estimateRealtimeTokens(instructions),
	};
}

/**
 * Spoken-channel addendum appended after the assembled support prompt. The
 * base scaffold + operator prompt + knowledge assembly is byte-identical to
 * the text agent's (one assembler, see buildSystem) — this only adapts the
 * delivery to audio.
 */
export const VOICE_CALL_STYLE_PROMPT = `# Voice call

You are on a live voice call with the visitor. Adapt your delivery:
1. Speak naturally and conversationally. Keep answers to one or two short sentences, then pause — never deliver a monologue or a list.
2. Never use markdown, bullet points, URLs spelled out character by character, or anything that only works in writing. Describe links ("the pricing page on our website") instead of reading them.
3. If the visitor asks for a human, tell them to use the "Talk to a human" option in the chat window — you cannot transfer the call.
4. If you can't hear them clearly or the question is ambiguous, ask a short clarifying question.
5. Open the call with ONE short greeting sentence offering to help, in the language the operator instructions are written in. If the visitor speaks a different language, switch to theirs.`;

/**
 * Assemble a project's voice instructions exactly like a chat turn, under the
 * voice budgets: knowledgeText hard-sliced, sources even-split into the voice
 * character budget, spoken addendum appended, whole thing token-ceiling
 * bounded. Pure.
 *
 * Three views of the size, for the two callers:
 *   - `estimatedTokens` — what actually SHIPS (post every budget).
 *   - `fullEstimatedTokens` — post char-budgets, pre token-ceiling: the number
 *     the mint's truncation warn reports.
 *   - `contentEstimatedTokens` — the operator's RAW content, no voice budgets
 *     at all (#182's formula): what the dashboard hint compares to the ceiling
 *     so a growing knowledge base is seen COMING, not only after it blows the
 *     token ceiling.
 *
 * `trimmed` is true when a voice session delivers LESS than the operator's
 * full content — any layer: the 8k knowledge slice, the 16k source even-split,
 * or the token ceiling. Detected by comparing this assembly against an
 * unbudgeted assembly of the same content THROUGH buildSystem ITSELF, so the
 * answer can never drift from what the assembler actually does. (`truncated`
 * remains the narrow token-ceiling flag the mint logs.)
 */
export function assembleVoiceInstructions(
	systemPrompt: string,
	knowledgeText: string,
	sources: { title: string; url: string; content: string }[],
	identity?: { name?: string | null; email?: string | null },
): {
	instructions: string;
	truncated: boolean;
	estimatedTokens: number;
	fullEstimatedTokens: number;
	contentEstimatedTokens: number;
	trimmed: boolean;
} {
	const assembled = buildSystem(
		systemPrompt,
		knowledgeText.slice(0, VOICE_MAX_KNOWLEDGE_CHARS),
		sources,
		identity,
		undefined,
		undefined,
		VOICE_MAX_SOURCES_CHARS,
	);
	const bounded = boundVoiceInstructions(assembled, VOICE_CALL_STYLE_PROMPT);
	const unbudgeted = buildSystem(
		systemPrompt,
		knowledgeText,
		sources,
		identity,
		undefined,
		undefined,
		Number.MAX_SAFE_INTEGER,
	);
	return {
		...bounded,
		fullEstimatedTokens: bounded.truncated
			? estimateRealtimeTokens(`${assembled}\n\n${VOICE_CALL_STYLE_PROMPT}`)
			: bounded.estimatedTokens,
		contentEstimatedTokens: estimateRealtimeTokens(
			`${unbudgeted}\n\n${VOICE_CALL_STYLE_PROMPT}`,
		),
		trimmed: bounded.truncated || unbudgeted !== assembled,
	};
}

/**
 * The project content a voice session is grounded in: the ACTIVE prompt (the
 * library row named by activeSystemPromptId when it resolves, else the
 * project's own systemPrompt) plus the active sources, mapped to buildSystem's
 * shape. Shared by the mint and the budget hint so neither can resolve the
 * prompt differently — the library-row override is exactly the kind of detail
 * a second implementation would forget.
 */
export async function loadVoiceGrounding(
	dbi: Database,
	project: {
		id: string;
		systemPrompt: string;
		activeSystemPromptId: string | null;
	},
): Promise<{
	promptContent: string;
	sources: { title: string; url: string; content: string }[];
}> {
	let promptContent = project.systemPrompt;
	if (project.activeSystemPromptId) {
		const active = await dbi.query.systemPrompt.findFirst({
			where: (sp, { and: a, eq: e }) =>
				a(e(sp.id, project.activeSystemPromptId!), e(sp.projectId, project.id)),
		});
		if (active) promptContent = active.content;
	}
	const activeSources = await dbi.query.source.findMany({
		where: (s, { and: a, eq: e }) =>
			a(e(s.projectId, project.id), e(s.active, true)),
	});
	return {
		promptContent,
		sources: activeSources.map((s) => ({
			title: s.title || s.url || "",
			url: s.url ?? "",
			content: s.content,
		})),
	};
}
