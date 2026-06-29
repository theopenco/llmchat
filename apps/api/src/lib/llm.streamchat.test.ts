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

	it("delivers visitor identity in the single system string, never as a messages-array entry", async () => {
		const env = {
			vars: { LLMGATEWAY_API_KEY: "k", LLMGATEWAY_BASE_URL: "u" },
		} as unknown as Parameters<typeof streamChat>[0];
		await streamChat(env, {
			model: "gpt-5.4-mini",
			systemPrompt:
				"When a visitor wants a human, collect their name and email.",
			knowledgeText: "",
			sources: [],
			identity: { name: "Jane", email: "jane@acme.com" },
			messages: [
				{ role: "user", parts: [{ type: "text", text: "hi" }] },
			] as unknown as Parameters<typeof streamChat>[1]["messages"],
		});
		// .at(-1): this file has no per-test mock reset, so target the most recent call.
		const arg = streamTextMock.mock.calls.at(-1)![0] as unknown as {
			system: string;
			messages: Array<{ role: string }>;
		};
		// Override + identity ride the ONE top-level `system` string (recency-weighted
		// the same way by every provider) — not an in-array system message that some
		// providers (e.g. Anthropic) reject or reorder.
		expect(arg.system).toContain("# Visitor");
		expect(arg.system).toContain("Name: Jane");
		expect(arg.system).toContain(
			"This overrides any earlier instruction to collect",
		);
		expect(arg.messages.some((m) => m.role === "system")).toBe(false);
	});
});
