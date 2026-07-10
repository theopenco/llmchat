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

/**
 * Start a fresh conversation: mint a new client id and persist it under the
 * same key, so the new conversation also survives reloads. The previous
 * conversation stays intact server-side (keyed by the old id) for the inbox.
 */
export function rotateClientId(): string {
	const id = crypto.randomUUID();
	sessionStorage.setItem(CLIENT_ID_KEY, id);
	return id;
}

export interface StoredIdentity {
	name: string;
	email: string;
}

// Visitor identity (name/email) persists DIFFERENTLY from the clientId above, on
// purpose: localStorage + a per-PROJECT key, vs the clientId's sessionStorage +
// global key. Why diverge?
//   - localStorage (not sessionStorage): a RETURNING visitor (new tab / after a
//     close) is remembered, so they aren't re-asked for their name. The anonymous
//     clientId only needs to survive a reload, so per-tab sessionStorage is enough.
//   - per-project key (not global): identity is PII, so a multi-widget origin must
//     not bleed one project's visitor into another project's form. An opaque
//     clientId carries no PII, so a shared global key is fine for it.
//   - 30-day TTL: bounds stale data and the shared-device window (a prior visitor on
//     a kiosk machine isn't prefilled forever). The server conversation row stays
//     authoritative — this is a convenience prefill only.
const IDENTITY_KEY_PREFIX = "llmchat_identity_";
const IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function identityKey(projectKey: string): string {
	return `${IDENTITY_KEY_PREFIX}${projectKey}`;
}

/**
 * The visitor's saved identity for this project, or null when missing, malformed,
 * expired (>30 days), or empty-named (an empty name must not skip the form into a
 * "Hi !" greeting — see the widget's name guard). Never throws: a disabled/blocked
 * localStorage or bad JSON resolves to null (form shows).
 */
export function getStoredIdentity(projectKey: string): StoredIdentity | null {
	try {
		const raw = localStorage.getItem(identityKey(projectKey));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const name = typeof parsed.name === "string" ? parsed.name : "";
		const email = typeof parsed.email === "string" ? parsed.email : "";
		const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
		const fresh = savedAt > 0 && Date.now() - savedAt <= IDENTITY_TTL_MS;
		// Unusable (empty name → would skip into a "Hi !" greeting) or expired/stale →
		// drop the entry (best-effort) and show the form.
		if (!name.trim() || !fresh) {
			try {
				localStorage.removeItem(identityKey(projectKey));
			} catch {
				// best-effort cleanup
			}
			return null;
		}
		return { name, email };
	} catch {
		return null;
	}
}

/**
 * Persist the visitor's identity for this project, stamped with the current time
 * for the TTL. Best-effort — a storage failure (private mode / quota / disabled) is
 * swallowed (the form simply won't be skipped next time).
 */
export function setStoredIdentity(
	projectKey: string,
	identity: StoredIdentity,
): void {
	try {
		localStorage.setItem(
			identityKey(projectKey),
			JSON.stringify({
				// Normalize on store so a padded "  Luca  " can't surface as "Hi   Luca  !".
				name: identity.name.trim(),
				email: identity.email.trim(),
				savedAt: Date.now(),
			}),
		);
	} catch {
		// ignore
	}
}

/** Concatenated text content of a UI message (ignores non-text parts). */
export function getText(m: UIMessage): string {
	return m.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text")
		.map((p) => p.text)
		.join("");
}
