import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

// The holding-ack copy now lives in @llmchat/shared/holding (single source of
// truth shared with the widget, which recognizes it to anchor the bubble). Re-
// exported here so existing `import { ESCALATED_HOLDING_MESSAGE } from "@/lib/holding"`
// callers (and chat.test.ts, which deliberately does NOT mock this module so the
// guard gets the REAL stream builder below) keep working unchanged.
export { ESCALATED_HOLDING_MESSAGE } from "@llmchat/shared/holding";

/**
 * Return the escalation holding acknowledgement as a v6 UI message stream that the
 * widget's useChat already renders — or, when `text` is null, an EMPTY stream that
 * completes cleanly with NO bot bubble (the throttled/cooldown case). Makes no
 * model call and writes nothing to the DB: a muted turn costs nothing. workerd-safe
 * (pure stream + Response, no Node deps).
 */
export function holdingStreamResponse(text: string | null): Response {
	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			if (!text) return; // empty stream → useChat completes with no bubble
			const id = crypto.randomUUID();
			writer.write({ type: "start" });
			writer.write({ type: "text-start", id });
			writer.write({ type: "text-delta", id, delta: text });
			writer.write({ type: "text-end", id });
			writer.write({ type: "finish" });
		},
	});
	return createUIMessageStreamResponse({ stream });
}
