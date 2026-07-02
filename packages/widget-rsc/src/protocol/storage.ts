import type { VisitorIdentity } from "../types";

// Storage keys deliberately match the script-tag widget (packages/widget in
// github.com/theopenco/llmchat): a site that migrates from the `<script>`
// embed to this SDK keeps its visitors' conversations and identity.
const CLIENT_ID_KEY = "llmchat_client_id";
const IDENTITY_KEY_PREFIX = "llmchat_identity_";
const IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-memory fallback for environments where web storage throws (some embedded
// webviews / privacy modes). Non-persistent, but the widget still works.
let memoryClientId: string | null = null;

/** Stable per-tab visitor id so a conversation survives reloads. */
export function getOrCreateClientId(): string {
	try {
		const existing = sessionStorage.getItem(CLIENT_ID_KEY);
		if (existing) {
			return existing;
		}
		const id = crypto.randomUUID();
		sessionStorage.setItem(CLIENT_ID_KEY, id);
		return id;
	} catch {
		memoryClientId ??= crypto.randomUUID();
		return memoryClientId;
	}
}

function identityKey(projectKey: string): string {
	return `${IDENTITY_KEY_PREFIX}${projectKey}`;
}

/**
 * The visitor's saved identity for this project, or null when missing,
 * malformed, expired (>30 days), or empty-named (an empty name must not skip
 * an identify step into a "Hi !" greeting). Never throws: disabled/blocked
 * localStorage or bad JSON resolves to null.
 *
 * Identity persists differently from the clientId on purpose: localStorage
 * (returning visitors are remembered across tabs) with a per-PROJECT key
 * (identity is PII — a multi-widget origin must not bleed one project's
 * visitor into another), while the opaque clientId lives in per-tab
 * sessionStorage under a global key.
 */
export function getStoredIdentity(projectKey: string): VisitorIdentity | null {
	try {
		const raw = localStorage.getItem(identityKey(projectKey));
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const name = typeof parsed.name === "string" ? parsed.name : "";
		const email = typeof parsed.email === "string" ? parsed.email : "";
		const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
		const fresh = savedAt > 0 && Date.now() - savedAt <= IDENTITY_TTL_MS;
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
 * Persist the visitor's identity for this project, stamped for the 30-day
 * TTL. Best-effort — a storage failure (private mode / quota / disabled) is
 * swallowed; the visitor is simply asked again next visit.
 */
export function setStoredIdentity(
	projectKey: string,
	identity: VisitorIdentity,
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
