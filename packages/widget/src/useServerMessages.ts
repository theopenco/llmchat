import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMessages } from "./messages-sync";

import type { ServerMessage } from "./messages-sync";

/** Poll cadence while the panel is open and the visitor is watching. */
export const POLL_INTERVAL_MS = 2_500;

/**
 * Poll the persisted conversation feed, so admin replies appear without a refresh.
 * Failed polls keep the last good result.
 *
 * Both the gate and the cadence are the caller's call: the widget polls fast while
 * the panel is open (the visitor is watching) and slowly in the background while it
 * is closed on an escalated conversation (nobody is watching, but a human owes them
 * a reply) — see unread.ts for that lifecycle and its cost.
 */
export function useServerMessages(
	apiUrl: string,
	projectKey: string,
	clientId: string,
	enabled: boolean,
	intervalMs: number = POLL_INTERVAL_MS,
): {
	serverMessages: ServerMessage[];
	conversationId: string | null;
	csatRating: number | null;
	escalatedAt: string | number | null;
	archivedAt: string | number | null;
	/**
	 * Whose feed the fields above describe, or null before the first poll of the
	 * current id lands. Everything here is cleared in a POST-COMMIT effect, so for
	 * one render after `clientId` rotates the feed still describes the conversation
	 * that was just left behind. A caller that persists anything derived from the
	 * feed must check this against the clientId it is persisting under — comparing
	 * two values from the same render closure is what makes the staleness visible.
	 */
	feedClientId: string | null;
	refresh: () => void;
} {
	const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [csatRating, setCsatRating] = useState<number | null>(null);
	const [escalatedAt, setEscalatedAt] = useState<string | number | null>(null);
	const [archivedAt, setArchivedAt] = useState<string | number | null>(null);
	const [feedClientId, setFeedClientId] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// A different clientId is a different conversation ("start a new
	// conversation" rotates it) — drop the old feed immediately instead of
	// showing stale messages until the first poll of the new id lands.
	useEffect(() => {
		setServerMessages([]);
		setConversationId(null);
		setCsatRating(null);
		setEscalatedAt(null);
		setArchivedAt(null);
		setFeedClientId(null);
	}, [apiUrl, projectKey, clientId]);

	const load = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			const feed = await fetchMessages(
				apiUrl,
				projectKey,
				clientId,
				controller.signal,
			);
			setServerMessages(feed.messages);
			setConversationId(feed.conversationId);
			setCsatRating(feed.csatRating);
			setEscalatedAt(feed.escalatedAt);
			setArchivedAt(feed.archivedAt);
			// Stamp whose feed this is (see the field's docs). `clientId` here is the
			// one this load was issued for, not whatever is current by the time it
			// resolves — a rotation aborts the in-flight request anyway.
			setFeedClientId(clientId);
		} catch {
			// Transient poll failure — keep showing the last good feed.
		}
	}, [apiUrl, projectKey, clientId]);

	useEffect(() => {
		if (!enabled || !clientId) {
			return;
		}
		// A cadence change (panel opened/closed) re-runs this and polls once
		// immediately — which is exactly right on close: it catches anything that
		// landed in the last foreground window, so the badge starts out honest.
		void load();
		const timer = setInterval(() => void load(), intervalMs);
		return () => {
			clearInterval(timer);
			abortRef.current?.abort();
		};
	}, [enabled, clientId, intervalMs, load]);

	const refresh = useCallback(() => {
		void load();
	}, [load]);

	return {
		serverMessages,
		conversationId,
		csatRating,
		escalatedAt,
		archivedAt,
		feedClientId,
		refresh,
	};
}
