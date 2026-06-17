import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMessages } from "./messages-sync";

import type { ServerMessage } from "./messages-sync";

const POLL_INTERVAL_MS = 2_500;

/**
 * Poll the persisted conversation feed while the widget is open, so admin
 * replies appear without a refresh. Failed polls keep the last good result.
 */
export function useServerMessages(
	apiUrl: string,
	projectKey: string,
	clientId: string,
	enabled: boolean,
): {
	serverMessages: ServerMessage[];
	conversationId: string | null;
	refresh: () => void;
} {
	const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
	const [conversationId, setConversationId] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

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
		} catch {
			// Transient poll failure — keep showing the last good feed.
		}
	}, [apiUrl, projectKey, clientId]);

	useEffect(() => {
		if (!enabled || !clientId) {
			return;
		}
		void load();
		const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
		return () => {
			clearInterval(timer);
			abortRef.current?.abort();
		};
	}, [enabled, clientId, load]);

	const refresh = useCallback(() => {
		void load();
	}, [load]);

	return { serverMessages, conversationId, refresh };
}
