import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

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
				return `## Source ${i + 1}: ${s.title}\nURL: ${s.url}\n\n${body}`;
			})
			.join("\n\n");
		parts.push(
			`# Reference sources\n\nThe following content was fetched from URLs the operator marked as active sources. Cite the source title or URL when you use information from them.\n\n${rendered}`,
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
