/**
 * Minimal reader for the AI SDK v6 UI message stream (`text/event-stream` of
 * `data: {json}` chunks terminated by `data: [DONE]`), as emitted by the
 * Clanker Support API's `POST /v1/chat`.
 *
 * Hand-rolled on purpose: the widget SDK only needs the concatenated text of
 * the assistant turn, and skipping the `ai` dependency keeps this package
 * zero-dependency (React is the only peer). Unknown chunk types (reasoning,
 * sources, steps, metadata) are ignored so future server additions can't
 * break deployed widgets.
 */
interface StreamChunk {
	type?: unknown;
	delta?: unknown;
	errorText?: unknown;
}

/**
 * Consume a UI message stream, invoking `onDelta` for every text delta.
 * Resolves with the full assistant text (empty string for a content-less
 * turn, e.g. the muted post-escalation acknowledgement envelope). Rejects
 * when the stream carries an `error` chunk.
 */
export async function readUIMessageStream(
	stream: ReadableStream<Uint8Array>,
	onDelta: (delta: string) => void,
): Promise<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let text = "";
	let done = false;
	try {
		while (!done) {
			const { value, done: streamDone } = await reader.read();
			if (streamDone) {
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			// SSE events are separated by a blank line; the trailing element may
			// be a partial event — keep it buffered for the next read.
			const events = buffer.split(/\r?\n\r?\n/);
			buffer = events.pop() ?? "";
			for (const event of events) {
				for (const line of event.split(/\r?\n/)) {
					if (!line.startsWith("data:")) {
						continue;
					}
					const payload = line.slice("data:".length).trim();
					if (payload === "[DONE]") {
						done = true;
						break;
					}
					let chunk: StreamChunk;
					try {
						chunk = JSON.parse(payload) as StreamChunk;
					} catch {
						// A malformed frame must not kill an otherwise-healthy stream.
						continue;
					}
					if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
						text += chunk.delta;
						onDelta(chunk.delta);
					} else if (chunk.type === "error") {
						throw new Error(
							typeof chunk.errorText === "string" && chunk.errorText
								? chunk.errorText
								: "assistant stream error",
						);
					}
				}
				if (done) {
					break;
				}
			}
		}
	} finally {
		// Also releases the lock; safe on an already-finished stream. Ensures a
		// `[DONE]` that arrives before EOF doesn't leave the body dangling.
		await reader.cancel().catch(() => {});
	}
	return text;
}
