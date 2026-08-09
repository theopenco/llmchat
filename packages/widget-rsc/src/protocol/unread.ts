import type { ServerMessage } from "./api";

/**
 * How often the provider polls /v1/messages while the panel is CLOSED, so a
 * visitor who escalated and then walked away still notices the human's reply.
 *
 * 25s, against the 2.5s foreground poll and the 4000-req/hour per-(project, IP)
 * cap on /v1/messages (widget-messages.ts in the api):
 *
 *   open panel        @2.5s → 1440 req/h → 36% of the cap, per tab
 *   closed, escalated  @25s →  144 req/h → 3.6% of the cap, per tab
 *
 * The cap is shared by every visitor behind one IP, so the ceiling that matters
 * is an office NAT: at 25s, ~27 closed-escalated tabs can sit on one IP before
 * the project's bucket is even theoretically at risk — and they're 10x cheaper
 * than a single open panel, which is what actually consumes it. 20s (180/h)
 * trades that headroom down to ~22 tabs to buy 5s of badge latency nobody
 * perceives; 30s (120/h) buys little more headroom for a slower badge. The
 * thing being waited on is a human typing a reply — an event measured in
 * minutes — so latency is the cheap axis and headroom is the dear one. 25s
 * takes the middle of the band. (Same arithmetic as packages/widget/src/
 * unread.ts — the script-tag widget this port mirrors.)
 *
 * Polls fail open (a 429 or an outage keeps the last good feed), so the worst
 * case of being wrong here is a late badge, never a broken widget.
 */
export const BACKGROUND_POLL_INTERVAL_MS = 25_000;

/**
 * One delayed re-fetch after a send settles. The api persists the assistant row
 * in a waitUntil AFTER the stream closes, so the immediate post-send refetch
 * can lose that race. When the visitor closed the panel mid-answer on a
 * NON-escalated conversation no poll runs — the immediate refetch and this one
 * retry are the only chances to see the row, so the badge depends on it.
 */
export const POST_STREAM_REFRESH_RETRY_MS = 2_500;

/** Counts above this render as "9+" — the launcher is 56px wide, not a mailbox. */
const BADGE_MAX = 9;

/**
 * Tab-local read state for the current conversation, persisted in
 * sessionStorage next to the clientId (protocol/storage.ts) — same scope, same
 * lifetime: a conversation lives in one tab, so its read state does too.
 *
 * What is stored is the MARKER, never the count. The count is always recomputed
 * from a fresh feed, so a reload can't resurrect a badge for messages that have
 * since been read elsewhere, and can't miss ones that arrived while the tab was
 * gone.
 */
export interface ConversationSnapshot {
	/**
	 * Owner of this snapshot. This SDK never rotates the clientId (no "start a
	 * new conversation" affordance), but the guard still matters: a record
	 * written under a different id — half-cleared storage, or a leftover from
	 * the script-tag widget before its id rotated — is treated as absent rather
	 * than trusted.
	 */
	clientId: string;
	/**
	 * Proof that a conversation EXISTS for this tab. The clientId alone is not:
	 * it's minted eagerly on mount for every pageview, chat or no chat. This
	 * field is what keeps a visitor who never opened the widget at zero
	 * background requests.
	 */
	conversationId: string;
	/** Escalated to a human — the only state in which anyone owes an out-of-band reply. */
	escalated: boolean;
	/** Resolved/archived — the handoff is over, nothing more is coming. */
	resolved: boolean;
	/** Sequence of the newest message the visitor has already seen (i.e. that was
	 * in the feed while the panel was open). */
	lastSeenSequence: number;
}

// Keyed per PROJECT, like the stored identity and unlike the clientId's one
// global key (see protocol/storage.ts). The clientId can be global because it's
// an opaque id two widgets on one origin can share harmlessly (a conversation
// is keyed by (project, clientId), so they still get one each). Read state
// can't: a snapshot names a conversation, so a shared record would let a second
// project's widget adopt the first's marker — and poll on behalf of a
// conversation that isn't its own. The prefix deliberately matches the
// script-tag widget's (packages/widget), like every key in storage.ts: a site
// migrating embeds keeps its visitors' read state too.
const SNAPSHOT_KEY_PREFIX = "llmchat_unread_";

function snapshotKey(projectKey: string): string {
	return `${SNAPSHOT_KEY_PREFIX}${projectKey}`;
}

/**
 * This tab's read state for a project, or null when there is none for
 * `clientId` — no conversation yet, a foreign id, or unreadable/corrupt
 * storage. Never throws: storage can be disabled or partitioned inside an
 * embedded webview, and the badge is a nicety, not a reason to take the widget
 * down.
 */
export function readSnapshot(
	projectKey: string,
	clientId: string,
): ConversationSnapshot | null {
	try {
		const raw = sessionStorage.getItem(snapshotKey(projectKey));
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		// Belongs to another (stale, or foreign) conversation → not ours to act on.
		if (parsed.clientId !== clientId) {
			return null;
		}
		const conversationId = parsed.conversationId;
		if (typeof conversationId !== "string" || !conversationId) {
			return null;
		}
		const seq = parsed.lastSeenSequence;
		return {
			clientId,
			conversationId,
			escalated: parsed.escalated === true,
			resolved: parsed.resolved === true,
			lastSeenSequence:
				typeof seq === "number" && Number.isFinite(seq) && seq >= 0 ? seq : 0,
		};
	} catch {
		return null;
	}
}

/** Persist the read state. Best-effort — a storage failure just costs the badge. */
export function writeSnapshot(
	projectKey: string,
	snapshot: ConversationSnapshot,
): void {
	try {
		sessionStorage.setItem(snapshotKey(projectKey), JSON.stringify(snapshot));
	} catch {
		// ignore
	}
}

/**
 * Forget the read state — the conversation it describes is gone (an operator
 * deleted it from the inbox). Leaving it would keep `shouldPollInBackground`
 * true and poll a dead thread for the life of the tab.
 */
export function clearSnapshot(projectKey: string): void {
	try {
		sessionStorage.removeItem(snapshotKey(projectKey));
	} catch {
		// ignore
	}
}

/** True when two snapshots carry the same state (nothing to persist or re-render). */
export function sameSnapshot(
	a: ConversationSnapshot,
	b: ConversationSnapshot,
): boolean {
	return (
		a.clientId === b.clientId &&
		a.conversationId === b.conversationId &&
		a.escalated === b.escalated &&
		a.resolved === b.resolved &&
		a.lastSeenSequence === b.lastSeenSequence
	);
}

/**
 * Whether to poll /v1/messages while the panel is CLOSED. Deliberately narrow —
 * a background request is only justified when a HUMAN owes this visitor a
 * reply:
 *
 *   - a conversation must exist in this tab (a pageview that never chatted
 *     makes ZERO background requests — the common case, and the whole point of
 *     gating on the snapshot rather than on the eagerly-minted clientId),
 *   - it must be escalated (nothing else produces a reply the visitor is away
 *     waiting for; the bot answers while they're watching), and
 *   - it must not be resolved (terminal — polling stops for good).
 *
 * The bot's own reply landing while the panel is closed still badges, because
 * the post-send refresh (plus its one delayed retry, POST_STREAM_REFRESH_
 * RETRY_MS) already fetches that feed; it just never earns a new timer.
 */
export function shouldPollInBackground(
	snapshot: ConversationSnapshot | null,
): boolean {
	return snapshot !== null && snapshot.escalated && !snapshot.resolved;
}

/** The highest sequence in the feed (0 when empty) — i.e. the head of the thread. */
export function latestSequence(messages: ServerMessage[]): number {
	// `sequence` is optional on this SDK's ServerMessage; a row without one
	// can't be ordered, so it contributes nothing to the head.
	return messages.reduce((max, m) => {
		const seq = m.sequence ?? 0;
		return seq > max ? seq : max;
	}, 0);
}

/**
 * How many messages the visitor hasn't seen: everything past the marker that
 * the panel will actually RENDER as somebody else's message.
 *
 * The predicate deliberately mirrors what the default UI shows — badging a row
 * the panel then doesn't show would send the visitor hunting for a message
 * that isn't there.
 *   - `user` rows are the visitor's own (including their replies that arrive by
 *     inbound email), so they never count;
 *   - empty content never renders, so it never counts;
 *   - rows without a sequence can't sit past any marker, so they never count;
 *   - `assistant` (the bot), `admin` (the human operator) and `system` (the
 *     escalation marker) all count.
 */
export function countUnread(
	messages: ServerMessage[],
	lastSeenSequence: number,
): number {
	return messages.filter(
		(m) =>
			(m.sequence ?? 0) > lastSeenSequence &&
			m.role !== "user" &&
			Boolean(m.content),
	).length;
}

/** Badge text: the exact count, capped at "9+". */
export function badgeLabel(count: number): string {
	return count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);
}

/**
 * Accessible name for the launcher. The count rides the button's label (and a
 * polite live region in the default UI) because the badge itself is decorative
 * — a screen reader must not have to see a pill to learn a human replied.
 */
export function launcherLabel(open: boolean, unreadCount: number): string {
	if (open) {
		return "Close chat";
	}
	if (unreadCount > 0) {
		return `Open chat, ${unreadCount} new ${
			unreadCount === 1 ? "message" : "messages"
		}`;
	}
	return "Open chat";
}
