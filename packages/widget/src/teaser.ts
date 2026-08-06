/**
 * Proactive teaser bubbles — the Chatbase-style floating messages that appear
 * above the closed launcher and invite the visitor in. Pure helpers + the
 * session-scoped "already seen it" persistence live here; rendering is
 * components/Teaser.tsx.
 *
 * Lifecycle: the teaser appears once per tab session, after a short delay, and
 * only while there is no conversation in this tab. Opening the panel (from the
 * teaser or the launcher) or dismissing it consumes it for the session —
 * re-showing after the visitor has already engaged is nagging, not inviting.
 */

import { useCallback, useEffect, useState } from "react";

/** Delay before the teaser slides in. Long enough that the page has settled
 * and the bubbles read as someone reaching out, not part of the page load. */
export const TEASER_DELAY_MS = 2_400;

/** At most two bubbles: a greeting and one follow-up line. More becomes a
 * wall of popups over the host page. */
export const MAX_TEASER_LINES = 2;

/** Fallback teaser when the project has no welcomeMessage configured. */
export const DEFAULT_TEASER = "👋 Hey! How can I help?";

/**
 * The teaser bubble lines for a project: each non-empty line of the operator's
 * welcomeMessage becomes one bubble (capped at MAX_TEASER_LINES), so operators
 * compose the stacked-bubble look with plain newlines. No welcomeMessage (or a
 * blank one) → the built-in default, as a single bubble.
 */
export function teaserLines(
	welcomeMessage: string | null | undefined,
): string[] {
	const lines = (welcomeMessage ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, MAX_TEASER_LINES);
	return lines.length > 0 ? lines : [DEFAULT_TEASER];
}

// sessionStorage (not localStorage) on purpose: a returning visitor in a NEW
// session is exactly who the teaser is for — only re-showing within the same
// tab session is noise. Per-project key so two widgets on one origin don't
// consume each other's teaser.
const TEASER_KEY_PREFIX = "llmchat_teaser_seen_";

function teaserKey(projectKey: string): string {
	return `${TEASER_KEY_PREFIX}${projectKey}`;
}

/** Whether this tab session has already consumed the teaser (dismissed it or
 * opened the panel). Never throws — blocked storage reads as "not seen". */
export function readTeaserSeen(projectKey: string): boolean {
	try {
		return sessionStorage.getItem(teaserKey(projectKey)) === "1";
	} catch {
		return false;
	}
}

/** Mark the teaser consumed for this tab session. Best-effort — with storage
 * blocked the teaser may re-show on reload, which is harmless. */
export function writeTeaserSeen(projectKey: string): void {
	try {
		sessionStorage.setItem(teaserKey(projectKey), "1");
	} catch {
		// ignore
	}
}

/**
 * Session-scoped teaser state: `show` flips true after TEASER_DELAY_MS unless
 * the teaser was already consumed this session; `consume` hides it for the
 * rest of the session (dismissed, or the panel was opened — either way the
 * invite has served its purpose). Callers layer their own conditions on top
 * (panel closed, no existing conversation).
 */
export function useTeaser(storageKey: string, enabled: boolean) {
	const [seen, setSeen] = useState(() => readTeaserSeen(storageKey));
	const [ready, setReady] = useState(false);
	useEffect(() => {
		if (!enabled || seen) {
			return;
		}
		const t = setTimeout(() => setReady(true), TEASER_DELAY_MS);
		return () => clearTimeout(t);
	}, [enabled, seen]);
	const consume = useCallback(() => {
		setSeen(true);
		writeTeaserSeen(storageKey);
	}, [storageKey]);
	return { show: enabled && ready && !seen, consume };
}
