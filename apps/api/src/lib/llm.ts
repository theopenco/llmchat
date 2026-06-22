import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import {
	streamText,
	generateText,
	convertToModelMessages,
	type UIMessage,
} from "ai";

import type { Env } from "@/env";

export interface LlmCallInput {
	model: string;
	systemPrompt: string;
	knowledgeText: string;
	sources?: { title: string; url: string; content: string }[];
	messages: UIMessage[];
}

// Cap aggregate source content to keep system prompts bounded. ~80k chars
// ≈ 20k tokens — well below typical 128k context windows but leaves room
// for knowledge base + conversation history.
const MAX_SOURCES_CHARS = 80_000;

export function buildSystem(
	systemPrompt: string,
	knowledgeText: string,
	sources: { title: string; url: string; content: string }[] = [],
) {
	const parts: string[] = [systemPrompt];
	if (knowledgeText.trim()) {
		parts.push(
			`# Knowledge base\n\nUse the following knowledge to answer questions. If the answer is not in the knowledge base, say so and offer to escalate to a human.\n\n${knowledgeText}`,
		);
	}

	const usable = sources.filter((s) => s.content.trim());
	if (usable.length > 0) {
		// Distribute the budget across sources so a single huge page can't
		// crowd out the rest.
		const perSource = Math.floor(MAX_SOURCES_CHARS / usable.length);
		const rendered = usable
			.map((s, i) => {
				const body =
					s.content.length > perSource
						? `${s.content.slice(0, perSource)}…`
						: s.content;
				// URL-less sources (manual text, promoted Q&A) omit the URL line
				// rather than printing "URL: " — the title is their handle.
				const head = s.url
					? `## Source ${i + 1}: ${s.title}\nURL: ${s.url}`
					: `## Source ${i + 1}: ${s.title}`;
				return `${head}\n\n${body}`;
			})
			.join("\n\n");
		parts.push(
			`# Reference sources\n\nThe following content comes from sources the operator marked active — fetched web pages and Q&A the team promoted from past conversations. Cite the source title or URL when you use information from them.\n\n${rendered}`,
		);
	}
	return parts.join("\n\n");
}

export async function streamChat(env: Env, input: LlmCallInput) {
	const gateway = createLLMGateway({
		apiKey: env.vars.LLMGATEWAY_API_KEY,
		baseURL: env.vars.LLMGATEWAY_BASE_URL,
	});

	return streamText({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		model: gateway(input.model as any),
		system: buildSystem(input.systemPrompt, input.knowledgeText, input.sources),
		messages: await convertToModelMessages(input.messages),
	});
}

// Cheapest adequate model for internal one-line triage summaries (gateway
// pricing ~$0.05/$0.40 per 1M tokens → ~0.009¢/summary). Hardcoded on purpose —
// NOT routed through effectiveModel()/the web-search guard (that would coerce it
// to the pricier agent default; summarizing an existing transcript needs no web
// search). Internal, operator-absorbed cost.
const SUMMARY_MODEL = "gpt-5-nano";

const SUMMARY_SYSTEM =
	'You write ONE short line summarizing a customer-support conversation for an agent scanning their inbox. Capture the visitor\'s core intent or issue — e.g. "Refund request for order #1234", "Asking about international shipping". Plain text, no surrounding quotes, no leading label like "Summary:". Max ~12 words.';

/**
 * One-line triage summary of a conversation transcript. Non-streaming, cheap
 * model, tight output cap. Returns the trimmed line, or null on ANY failure — so
 * the caller leaves the cache untouched and the inbox keeps showing the snippet,
 * never a fabricated or partial summary. Writes nothing itself (no usageEvent).
 */
export async function summarizeConversation(
	env: Env,
	transcript: string,
): Promise<string | null> {
	if (!transcript.trim()) return null;
	const gateway = createLLMGateway({
		apiKey: env.vars.LLMGATEWAY_API_KEY,
		baseURL: env.vars.LLMGATEWAY_BASE_URL,
	});
	try {
		const { text } = await generateText({
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			model: gateway(SUMMARY_MODEL as any),
			system: SUMMARY_SYSTEM,
			prompt: transcript,
			maxOutputTokens: 60,
		});
		const line = text.trim().replace(/\s+/g, " ");
		return line || null;
	} catch (err) {
		console.warn("summarizeConversation: generation failed", err);
		return null;
	}
}
