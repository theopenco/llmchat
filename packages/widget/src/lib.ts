import type { UIMessage } from "ai";

const CLIENT_ID_KEY = "llmchat_client_id";

/** Stable per-tab visitor id so a conversation survives reloads. */
export function getOrCreateClientId(): string {
	const existing = sessionStorage.getItem(CLIENT_ID_KEY);
	if (existing) {
		return existing;
	}
	const id = crypto.randomUUID();
	sessionStorage.setItem(CLIENT_ID_KEY, id);
	return id;
}

/** Concatenated text content of a UI message (ignores non-text parts). */
export function getText(m: UIMessage): string {
	return m.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text")
		.map((p) => p.text)
		.join("");
}
