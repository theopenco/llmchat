import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

/**
 * The static, automated acknowledgement a visitor sees IN PLACE of an AI reply
 * when they message a conversation that's escalated to a human. Clearly labelled
 * automated and promises no timeline (honesty rail). Exported so the stream, the
 * tests, and any client-side copy share one source of truth.
 *
 * Deliberately NOT placed in @/lib/llm: chat.test.ts mocks that whole module, and
 * the guard needs the REAL builder to produce a drainable stream in tests.
 */
export const ESCALATED_HOLDING_MESSAGE =
	"This is an automated message. Thanks — your reply has been added to the conversation and our support team will follow up here. Feel free to keep adding details in the meantime.";

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
