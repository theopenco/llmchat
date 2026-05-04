import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { streamText, convertToModelMessages, type UIMessage } from "ai";

import type { Env } from "@/env";

export interface LlmCallInput {
	model: string;
	systemPrompt: string;
	knowledgeText: string;
	messages: UIMessage[];
}

export function buildSystem(systemPrompt: string, knowledgeText: string) {
	if (!knowledgeText.trim()) {
		return systemPrompt;
	}
	return `${systemPrompt}\n\n# Knowledge base\n\nUse the following knowledge to answer questions. If the answer is not in the knowledge base, say so and offer to escalate to a human.\n\n${knowledgeText}`;
}

export async function streamChat(env: Env, input: LlmCallInput) {
	const gateway = createLLMGateway({
		apiKey: env.LLMGATEWAY_API_KEY,
		baseURL: env.LLMGATEWAY_BASE_URL,
	});

	return streamText({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		model: gateway(input.model as any),
		system: buildSystem(input.systemPrompt, input.knowledgeText),
		messages: await convertToModelMessages(input.messages),
	});
}
