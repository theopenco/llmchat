import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

// The holding-ack copy now lives in @llmchat/shared/holding (single source of
// truth shared with the widget, which recognizes it to anchor the bubble). Re-
// exported here so existing `import { ESCALATED_HOLDING_MESSAGE } from "@/lib/holding"`
// callers (and chat.test.ts, which deliberately does NOT mock this module so the
// guard gets the REAL stream builder below) keep working unchanged.
export { ESCALATED_HOLDING_MESSAGE } from "@llmchat/shared/holding";

/**
 * Return the escalation holding acknowledgement as a v6 UI message stream that the
 * widget's useChat already renders — or, when `text` is null, a content-less
 * message envelope that completes cleanly with NO bot bubble (the muted
 * post-escalation turn; the widget drops the empty content). Makes no
 * model call and writes nothing to the DB: a muted turn costs nothing. workerd-safe
 * (pure stream + Response, no Node deps).
 */
export function holdingStreamResponse(text: string | null): Response {
	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			// Always emit a COMPLETE message envelope so the widget's useChat settles
			// cleanly. An event-less stream leaves useChat in an error state ("Something
			// went wrong sending your message"), which broke every muted post-escalation
			// turn. With no text we emit just start+finish — a content-less assistant
			// turn the widget renders as nothing (MessageList drops empty content).
			writer.write({ type: "start" });
			if (text) {
				const id = crypto.randomUUID();
				writer.write({ type: "text-start", id });
				writer.write({ type: "text-delta", id, delta: text });
				writer.write({ type: "text-end", id });
			}
			writer.write({ type: "finish" });
		},
	});
	return createUIMessageStreamResponse({ stream });
}
