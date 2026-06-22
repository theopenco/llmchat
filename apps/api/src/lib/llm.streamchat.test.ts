import { describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above module-level consts, so the captured mock must be
// created via vi.hoisted to exist when the factory runs.
const { streamTextMock } = vi.hoisted(() => ({
	streamTextMock: vi.fn((_opts: { maxOutputTokens?: number }) => ({
		ok: true,
	})),
}));

vi.mock("ai", () => ({
	streamText: streamTextMock,
	generateText: vi.fn(),
	convertToModelMessages: vi.fn(async (m: unknown) => m),
}));
vi.mock("@llmgateway/ai-sdk-provider", () => ({
	createLLMGateway: () => (modelId: string) => ({ modelId }),
}));

import { streamChat } from "./llm";

describe("streamChat — output cap (shared-key spend ceiling)", () => {
	it("passes a bounded maxOutputTokens to streamText", async () => {
		const env = {
			vars: { LLMGATEWAY_API_KEY: "k", LLMGATEWAY_BASE_URL: "u" },
		} as unknown as Parameters<typeof streamChat>[0];
		await streamChat(env, {
			model: "gpt-5.4-mini",
			systemPrompt: "be nice",
			knowledgeText: "",
			sources: [],
			messages: [],
		});
		expect(streamTextMock).toHaveBeenCalledTimes(1);
		const arg = streamTextMock.mock.calls[0]![0];
		expect(typeof arg.maxOutputTokens).toBe("number");
		expect(arg.maxOutputTokens).toBeGreaterThan(0);
		expect(arg.maxOutputTokens).toBeLessThanOrEqual(2_000);
	});
});
