import { describe, expect, it } from "vitest";

import { readUIMessageStream } from "./stream";

function streamOf(...raw: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of raw) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

function sse(chunk: unknown): string {
	return `data: ${JSON.stringify(chunk)}\n\n`;
}

describe("readUIMessageStream", () => {
	it("accumulates text deltas and reports each to onDelta", async () => {
		const deltas: string[] = [];
		const text = await readUIMessageStream(
			streamOf(
				sse({ type: "start" }),
				sse({ type: "text-start", id: "t1" }),
				sse({ type: "text-delta", id: "t1", delta: "Hello" }),
				sse({ type: "text-delta", id: "t1", delta: ", world" }),
				sse({ type: "text-end", id: "t1" }),
				sse({ type: "finish" }),
				"data: [DONE]\n\n",
			),
			(d) => deltas.push(d),
		);
		expect(text).toBe("Hello, world");
		expect(deltas).toEqual(["Hello", ", world"]);
	});

	it("handles events split across network reads", async () => {
		const full =
			sse({ type: "text-start", id: "t1" }) +
			sse({ type: "text-delta", id: "t1", delta: "chunked" }) +
			"data: [DONE]\n\n";
		// Split mid-JSON to prove buffering works.
		const cut = full.indexOf("chun");
		const text = await readUIMessageStream(
			streamOf(full.slice(0, cut), full.slice(cut)),
			() => {},
		);
		expect(text).toBe("chunked");
	});

	it("resolves empty for a content-less holding envelope (start+finish only)", async () => {
		const deltas: string[] = [];
		const text = await readUIMessageStream(
			streamOf(
				sse({ type: "start" }),
				sse({ type: "finish" }),
				"data: [DONE]\n\n",
			),
			(d) => deltas.push(d),
		);
		expect(text).toBe("");
		expect(deltas).toEqual([]);
	});

	it("ignores unknown chunk types (sources, reasoning, steps)", async () => {
		const text = await readUIMessageStream(
			streamOf(
				sse({ type: "start-step" }),
				sse({ type: "reasoning-delta", id: "r", delta: "hmm" }),
				sse({ type: "source-url", url: "https://example.com" }),
				sse({ type: "text-delta", id: "t1", delta: "answer" }),
				"data: [DONE]\n\n",
			),
			() => {},
		);
		expect(text).toBe("answer");
	});

	it("rejects when the stream carries an error chunk", async () => {
		await expect(
			readUIMessageStream(
				streamOf(sse({ type: "error", errorText: "model unavailable" })),
				() => {},
			),
		).rejects.toThrow("model unavailable");
	});

	it("survives a malformed frame without dropping the rest", async () => {
		const text = await readUIMessageStream(
			streamOf(
				"data: {not json}\n\n",
				sse({ type: "text-delta", id: "t1", delta: "still here" }),
				"data: [DONE]\n\n",
			),
			() => {},
		);
		expect(text).toBe("still here");
	});

	it("resolves at end-of-stream even without [DONE]", async () => {
		const text = await readUIMessageStream(
			streamOf(sse({ type: "text-delta", id: "t1", delta: "eof" })),
			() => {},
		);
		expect(text).toBe("eof");
	});
});
