import type { UIMessage } from "ai";

const CLIENT_ID_KEY = "llmchat_client_id";
const IDENTITY_KEY = "llmchat_identity";

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

/** The visitor's name + (optional) email, captured once by the identify form. */
export interface StoredIdentity {
	name: string;
	email: string;
}

/**
 * Read the saved identity from localStorage so a reload skips the name/email
 * form (the conversation itself survives via the sessionStorage clientId).
 * Returns null when none is stored. Safe everywhere: any access failure
 * (private mode, SSR, malformed JSON) resolves to null.
 */
export function getStoredIdentity(): StoredIdentity | null {
	try {
		const raw = localStorage.getItem(IDENTITY_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
		if (typeof parsed?.name !== "string" || !parsed.name) return null;
		return {
			name: parsed.name,
			email: typeof parsed.email === "string" ? parsed.email : "",
		};
	} catch {
		return null;
	}
}

/** Persist the visitor's identity. No-ops if storage is unavailable. */
export function setStoredIdentity(identity: StoredIdentity): void {
	try {
		localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
	} catch {
		// private mode / storage disabled — non-fatal, the form just re-shows.
	}
}

/** Concatenated text content of a UI message (ignores non-text parts). */
export function getText(m: UIMessage): string {
	return m.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text")
		.map((p) => p.text)
		.join("");
}
