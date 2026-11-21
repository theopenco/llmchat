// Wire-level check of the inference path against a local OpenAI-compatible
// server: the real LLM Gateway provider + AI SDK streamText, then the same
// UI-message-stream response the /v1/chat route returns. Catches provider/SDK
// major-version drift (request shape, SSE parsing, usage accounting) that the
// mocked route tests can't see.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { streamChat } from "./llm";

import type { Env } from "@/env";

let server: Server;
let baseURL = "";
const requests: { url: string; body: Record<string, unknown> }[] = [];

beforeAll(async () => {
	server = createServer((req, res) => {
		let raw = "";
		req.on("data", (c) => (raw += c));
		req.on("end", () => {
			requests.push({ url: req.url ?? "", body: JSON.parse(raw || "{}") });
			res.writeHead(200, { "content-type": "text/event-stream" });
			const base = {
				id: "chatcmpl-1",
				object: "chat.completion.chunk",
				created: 1,
				model: "gpt-5.4-mini",
			};
			const send = (d: unknown) => res.write(`data: ${JSON.stringify(d)}\n\n`);
			send({
				...base,
				choices: [{ index: 0, delta: { role: "assistant", content: "" } }],
			});
			for (const piece of ["We help ", "with Acme Tools."]) {
				send({ ...base, choices: [{ index: 0, delta: { content: piece } }] });
			}
			send({
				...base,
				choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
				usage: { prompt_tokens: 42, completion_tokens: 6, total_tokens: 48 },
			});
			res.end("data: [DONE]\n\n");
		});
	});
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("streamChat over the wire", () => {
	it("streams text, meters usage, and serves a UI message stream", async () => {
		const env = {
			vars: { LLMGATEWAY_API_KEY: "test-key", LLMGATEWAY_BASE_URL: baseURL },
		} as unknown as Env;

		const result = await streamChat(env, {
			model: "gpt-5.4-mini",
			systemPrompt: "You are the Acme Tools support agent.",
			knowledgeText: "",
			sources: [],
			messages: [
				{
					id: "m1",
					role: "user",
					parts: [{ type: "text", text: "What do you do?" }],
				},
			],
		});
		const res = createUIMessageStreamResponse({
			stream: toUIMessageStream({ stream: result.stream }),
		});
		const body = await res.text();

		expect(res.headers.get("content-type")).toContain("text/event-stream");
		expect(body).toContain('"type":"text-delta"');
		expect(body).toContain("Acme Tools.");
		expect(await result.text).toBe("We help with Acme Tools.");
		const usage = await result.usage;
		expect(usage.inputTokens).toBe(42);
		expect(usage.outputTokens).toBe(6);

		expect(requests).toHaveLength(1);
		expect(requests[0]!.url).toBe("/v1/chat/completions");
		const sent = requests[0]!.body as {
			model: string;
			stream: boolean;
			messages: { role: string; content: unknown }[];
		};
		expect(sent.model).toBe("gpt-5.4-mini");
		expect(sent.stream).toBe(true);
		expect(sent.messages[0]!.role).toBe("system");
		expect(JSON.stringify(sent.messages[0]!.content)).toContain(
			"Acme Tools support agent",
		);
		expect(sent.messages.at(-1)!.role).toBe("user");
	});
});
