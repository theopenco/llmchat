"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ClankerSupportContext } from "./context";
import {
	ClankerApiError,
	EMPTY_FEED,
	fetchFeed,
	fetchWidgetConfig,
	postChat,
	rateConversation,
	rateMessage,
	requestEscalation,
	requestResolve,
} from "../protocol/api";
import { DEFAULT_API_URL } from "../protocol/constants";
import { mergeMessages } from "../protocol/merge";
import {
	getOrCreateClientId,
	getStoredIdentity,
	setStoredIdentity,
} from "../protocol/storage";
import { readUIMessageStream } from "../protocol/stream";

import type { ClankerSupportContextValue } from "./context";
import type { MessageFeed, OutgoingUIMessage } from "../protocol/api";
import type { LocalMessage } from "../protocol/merge";
import type {
	ChatMessage,
	ChatStatus,
	MessageRating,
	VisitorIdentity,
	WidgetConfig,
	WidgetPosition,
} from "../types";

const POLL_INTERVAL_MS = 2_500;
const DEFAULT_ESCALATION_THRESHOLD = 3;
/** History cap sent to /v1/chat — the api accepts up to 200 messages. */
const MAX_HISTORY = 100;
const SEND_ERROR =
	"Something went wrong sending your message. Please try again.";
const DEFAULT_BRAND_COLOR = "#111827";

/**
 * The configured human-handoff threshold, or the default when it's missing or
 * below 1 (a project must allow at least one message before escalation).
 */
export function resolveEscalationThreshold(value?: number): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 1
		? Math.floor(value)
		: DEFAULT_ESCALATION_THRESHOLD;
}

export interface ClankerSupportProviderProps {
	/** The project's public widget key (Dashboard → Project → Embed). */
	apiKey: string;
	/** API origin; defaults to the hosted Clanker Support API. Self-hosters point this at their own deployment. */
	apiUrl?: string;
	/** Accent color exposed to primitives (and as `--clanker-brand` in the default UI). */
	brandColor?: string;
	/** Corner the default UI docks to. Exposed to headless consumers via context. */
	position?: WidgetPosition;
	/** User messages before "Talk to a human" becomes available. Default 3. */
	escalationThreshold?: number;
	/** Local greeting bubble copy. `null` disables it; omit for the built-in default. */
	greeting?: string | null;
	/** Open the panel on mount (default false). */
	defaultOpen?: boolean;
	/**
	 * Server-prefetched `GET /v1/config/:key` payload — the RSC entry passes
	 * this so the client skips its config round-trip. When absent, the
	 * provider fetches it client-side with fail-safe defaults.
	 */
	initialConfig?: WidgetConfig | null;
	children?: React.ReactNode;
}

export function ClankerSupportProvider({
	apiKey,
	apiUrl: apiUrlProp,
	brandColor = DEFAULT_BRAND_COLOR,
	position = "bottom-right",
	escalationThreshold,
	greeting,
	defaultOpen = false,
	initialConfig,
	children,
}: ClankerSupportProviderProps) {
	const apiUrl = (apiUrlProp ?? DEFAULT_API_URL).replace(/\/+$/, "");

	// ── Panel ─────────────────────────────────────────────────────────
	const [open, setOpenState] = useState(defaultOpen);
	const setOpen = useCallback((next: boolean) => setOpenState(next), []);
	const toggle = useCallback(() => setOpenState((v) => !v), []);

	// ── Visitor (client-only state, hydration-safe) ───────────────────
	// clientId/identity live in web storage, so they're resolved in effects —
	// server HTML and the first client render agree (both empty).
	const [clientId, setClientId] = useState("");
	const clientIdRef = useRef("");
	const ensureClientId = useCallback((): string => {
		if (!clientIdRef.current) {
			clientIdRef.current = getOrCreateClientId();
			setClientId(clientIdRef.current);
		}
		return clientIdRef.current;
	}, []);
	useEffect(() => {
		ensureClientId();
	}, [ensureClientId]);

	const [identity, setIdentity] = useState<VisitorIdentity | null>(null);
	const identityRef = useRef<VisitorIdentity | null>(null);
	useEffect(() => {
		const stored = getStoredIdentity(apiKey);
		identityRef.current = stored;
		setIdentity(stored);
	}, [apiKey]);
	const identify = useCallback(
		(next: VisitorIdentity) => {
			const clean = { name: next.name.trim(), email: next.email.trim() };
			if (!clean.name) {
				return; // an empty name must never identify (avoids "Hi !" greetings)
			}
			setStoredIdentity(apiKey, clean);
			identityRef.current = clean;
			setIdentity(clean);
		},
		[apiKey],
	);

	// ── Server config (branding / privacy) ────────────────────────────
	const [config, setConfig] = useState<WidgetConfig>(
		() => initialConfig ?? { showBranding: true, privacyPolicyUrl: null },
	);
	const hasServerConfig = initialConfig != null;
	useEffect(() => {
		if (hasServerConfig) {
			return;
		}
		let active = true;
		void fetchWidgetConfig(apiUrl, apiKey).then((cfg) => {
			if (active && cfg) {
				setConfig(cfg);
			}
		});
		return () => {
			active = false;
		};
	}, [apiUrl, apiKey, hasServerConfig]);

	// ── Persisted feed (poll while open) ──────────────────────────────
	const [feed, setFeed] = useState<MessageFeed>(EMPTY_FEED);
	const feedRef = useRef<MessageFeed>(EMPTY_FEED);
	const feedAbortRef = useRef<AbortController | null>(null);
	const loadFeed = useCallback(async () => {
		const cid = clientIdRef.current;
		if (!cid) {
			return;
		}
		feedAbortRef.current?.abort();
		const controller = new AbortController();
		feedAbortRef.current = controller;
		try {
			const next = await fetchFeed(apiUrl, apiKey, cid, controller.signal);
			feedRef.current = next;
			setFeed(next);
		} catch {
			// Transient poll failure — keep showing the last good feed.
		}
	}, [apiUrl, apiKey]);
	const refresh = useCallback(() => {
		void loadFeed();
	}, [loadFeed]);

	useEffect(() => {
		if (!open || !clientId) {
			return;
		}
		void loadFeed();
		const timer = setInterval(() => void loadFeed(), POLL_INTERVAL_MS);
		return () => {
			clearInterval(timer);
			feedAbortRef.current?.abort();
		};
	}, [open, clientId, loadFeed]);

	// ── Local chat state ──────────────────────────────────────────────
	const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
	const [status, setStatus] = useState<ChatStatus>("idle");
	const [sendError, setSendError] = useState<{
		message: string;
		code: string | null;
	} | null>(null);
	const [draft, setDraftState] = useState("");
	const draftRef = useRef("");
	const setDraft = useCallback((value: string) => {
		draftRef.current = value;
		setDraftState(value);
	}, []);

	// ── Handoff / feedback state ──────────────────────────────────────
	const [escalatedLocal, setEscalatedLocal] = useState(false);
	const [escalating, setEscalating] = useState(false);
	const [escalateFailed, setEscalateFailed] = useState(false);
	const [escalationSummary, setEscalationSummary] = useState<string | null>(
		null,
	);
	const [resolvedLocal, setResolvedLocal] = useState(false);
	const [resolving, setResolving] = useState(false);
	const [resolveFailed, setResolveFailed] = useState(false);
	const [csatRated, setCsatRated] = useState(false);
	const [ratingOverrides, setRatingOverrides] = useState<
		Record<string, MessageRating>
	>({});

	// Escalated/resolved this session OR per the server feed — hydrating from
	// the feed keeps handoff state across reloads (the CTA can't reappear and
	// re-fire /v1/escalate).
	const escalated = escalatedLocal || feed.escalatedAt != null;
	const resolved = resolvedLocal || feed.archivedAt != null;

	// ── Merged display messages ───────────────────────────────────────
	const messages = useMemo<ChatMessage[]>(() => {
		const merged = mergeMessages(feed.messages, localMessages);
		// Optimistic rating overrides layered on top of the polled feed.
		return merged.map((m) =>
			m.rateable && m.id in ratingOverrides
				? { ...m, rating: ratingOverrides[m.id] }
				: m,
		);
	}, [feed.messages, localMessages, ratingOverrides]);
	const messagesRef = useRef<ChatMessage[]>(messages);
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	// ── Quote-reply ───────────────────────────────────────────────────
	// The message the visitor is replying to (drives the "Replying to:" bar). Held
	// in a ref alongside state so `send` reads the value current at send time
	// without taking it as a dependency (same pattern as the draft).
	const [replyTo, setReplyToState] = useState<ChatMessage | null>(null);
	const replyToRef = useRef<ChatMessage | null>(null);
	const setReplyTo = useCallback((message: ChatMessage | null) => {
		// `system` rows are internal markers the widget never renders — refuse them
		// here so a custom UI can't build a reply the api would only drop anyway.
		const next = message && message.role === "system" ? null : message;
		replyToRef.current = next;
		setReplyToState(next);
	}, []);
	// Drop the pending reply if its target disappears from the loaded thread (e.g.
	// the conversation was reset) — never send a reference to a message we can no
	// longer show the visitor.
	useEffect(() => {
		const target = replyToRef.current;
		if (target && !messages.some((m) => m.id === target.id)) {
			setReplyTo(null);
		}
	}, [messages, setReplyTo]);

	// Reads `messages` (state), NOT messagesRef: the ref is synced in an effect, so
	// a ref-backed lookup would still see the previous thread on the render where
	// the feed arrives — and, being ref-backed, would never re-render to correct
	// itself. The quote chip would stay stuck on its "not in the thread" fallback.
	const findMessage = useCallback(
		(id: string) => messages.find((m) => m.id === id) ?? null,
		[messages],
	);

	// ── Send ──────────────────────────────────────────────────────────
	const busyRef = useRef(false);
	const sendAbortRef = useRef<AbortController | null>(null);
	useEffect(
		() => () => {
			sendAbortRef.current?.abort();
		},
		[],
	);

	const send = useCallback(
		async (input?: string) => {
			const value = (input ?? draftRef.current).trim();
			if (!value || busyRef.current) {
				return;
			}
			busyRef.current = true;
			if (input === undefined) {
				setDraft("");
			}
			setSendError(null);

			// Consume the pending quote-reply: attached to this turn, then cleared, so
			// the next message isn't silently sent as another reply to the same target.
			const quoted = replyToRef.current;
			setReplyTo(null);

			const userMessage: LocalMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content: value,
				// Optimistic: renders the chip on the sent bubble immediately. The feed
				// replaces this row with the persisted one (carrying the server-validated
				// reference) on the next poll.
				replyToMessageId: quoted?.id ?? null,
			};
			// Model context = persisted user/assistant turns + this message. Admin
			// and system rows are dashboard-side concepts the model API rejects.
			const history: OutgoingUIMessage[] = [
				...messagesRef.current.filter(
					(m): m is ChatMessage & { role: "user" | "assistant" } =>
						m.role === "user" || m.role === "assistant",
				),
				userMessage,
			]
				.slice(-MAX_HISTORY)
				.map((m) => ({
					id: m.id,
					role: m.role,
					parts: [{ type: "text" as const, text: m.content }],
				}));

			setLocalMessages((prev) => [...prev, userMessage]);
			setStatus("submitted");

			const controller = new AbortController();
			sendAbortRef.current = controller;
			const assistantId = crypto.randomUUID();
			let assistantAdded = false;
			try {
				const stream = await postChat(
					apiUrl,
					{
						projectKey: apiKey,
						clientId: ensureClientId(),
						name: identityRef.current?.name,
						email: identityRef.current?.email || undefined,
						// Top-level, per-turn: the id of the message this turn replies to.
						// The api re-validates it against the conversation and drops it if
						// it doesn't belong, so a stale id degrades to a plain message.
						...(quoted ? { replyToMessageId: quoted.id } : {}),
						messages: history,
					},
					controller.signal,
				);
				setStatus("streaming");
				await readUIMessageStream(stream, (delta) => {
					if (assistantAdded) {
						setLocalMessages((prev) =>
							prev.map((m) =>
								m.id === assistantId ? { ...m, content: m.content + delta } : m,
							),
						);
					} else {
						// A content-less turn (muted post-escalation envelope) adds no bubble.
						assistantAdded = true;
						setLocalMessages((prev) => [
							...prev,
							{ id: assistantId, role: "assistant", content: delta },
						]);
					}
				});
				setStatus("idle");
				// Refetch so the just-persisted exchange replaces the local copy.
				void loadFeed();
			} catch (err) {
				if (controller.signal.aborted) {
					setStatus("idle"); // unmount/cancel — not an error state
					return;
				}
				setSendError({
					message: SEND_ERROR,
					code: err instanceof ClankerApiError ? err.code : null,
				});
				setStatus("error");
			} finally {
				busyRef.current = false;
				if (sendAbortRef.current === controller) {
					sendAbortRef.current = null;
				}
			}
		},
		[apiUrl, apiKey, ensureClientId, loadFeed, setDraft, setReplyTo],
	);

	// ── Escalation / resolve ──────────────────────────────────────────
	const escalate = useCallback(async () => {
		if (escalating) {
			return;
		}
		setEscalating(true);
		setEscalateFailed(false);
		try {
			const { summary } = await requestEscalation(apiUrl, {
				projectKey: apiKey,
				clientId: ensureClientId(),
				name: identityRef.current?.name,
				email: identityRef.current?.email || undefined,
				// The api rebuilds the operator transcript from stored rows; this
				// body satisfies the schema and is otherwise ignored.
				messages: messagesRef.current.map(({ role, content }) => ({
					role,
					content,
				})),
			});
			setEscalationSummary(summary);
			setEscalatedLocal(true);
			void loadFeed();
		} catch {
			setEscalateFailed(true);
		} finally {
			setEscalating(false);
		}
	}, [apiUrl, apiKey, ensureClientId, escalating, loadFeed]);

	const resolve = useCallback(async () => {
		if (resolving) {
			return;
		}
		setResolving(true);
		setResolveFailed(false);
		try {
			const { resolved: didResolve } = await requestResolve(apiUrl, {
				projectKey: apiKey,
				clientId: ensureClientId(),
			});
			// A decline (escalated — a human owns the conversation) is benign:
			// re-poll so the escalated state surfaces instead of an error.
			if (didResolve) {
				setResolvedLocal(true);
			}
			void loadFeed();
		} catch {
			setResolveFailed(true);
		} finally {
			setResolving(false);
		}
	}, [apiUrl, apiKey, ensureClientId, loadFeed, resolving]);

	// ── Feedback ──────────────────────────────────────────────────────
	const rate = useCallback(
		async (messageId: string, intent: "up" | "down") => {
			const conversationId = feedRef.current.conversationId;
			if (!conversationId) {
				return;
			}
			const current =
				messagesRef.current.find((m) => m.id === messageId)?.rating ?? null;
			const next: MessageRating = current === intent ? null : intent;
			setRatingOverrides((o) => ({ ...o, [messageId]: next }));
			try {
				await rateMessage(apiUrl, {
					projectKey: apiKey,
					clientId: ensureClientId(),
					conversationId,
					messageId,
					rating: next,
				});
			} catch {
				// Roll back to exactly what was displayed before the click.
				setRatingOverrides((o) => ({ ...o, [messageId]: current }));
			}
		},
		[apiUrl, apiKey, ensureClientId],
	);

	const submitCsat = useCallback(
		async (rating: number) => {
			setCsatRated(true);
			const conversationId = feedRef.current.conversationId;
			if (!conversationId) {
				return;
			}
			// Best-effort: a failed POST must never trap the visitor.
			try {
				await rateConversation(apiUrl, {
					projectKey: apiKey,
					clientId: ensureClientId(),
					conversationId,
					rating,
				});
			} catch {
				// ignore
			}
		},
		[apiUrl, apiKey, ensureClientId],
	);

	// ── Derived gates ─────────────────────────────────────────────────
	const userMessageCount = useMemo(
		() => messages.filter((m) => m.role === "user").length,
		[messages],
	);
	const hasRealExchange =
		feed.messages.some((m) => m.role === "user") &&
		feed.messages.some((m) => m.role === "assistant");
	const threshold = resolveEscalationThreshold(escalationThreshold);
	const canEscalate = !escalated && !resolved && userMessageCount >= threshold;
	// The operator closes escalated chats — visitors can't resolve over a handoff.
	const canResolve = !escalated && !resolved && hasRealExchange;
	const csatEligible = hasRealExchange && feed.csatRating == null && !csatRated;

	const resolvedGreeting =
		greeting === null
			? null
			: (greeting ??
				(identity?.name
					? `Hi ${identity.name}! How can I help?`
					: "Hi! How can I help?"));

	const contextValue = useMemo<ClankerSupportContextValue>(
		() => ({
			apiKey,
			apiUrl,
			brandColor,
			position,
			greeting: resolvedGreeting,
			showBranding: config.showBranding,
			privacyPolicyUrl: config.privacyPolicyUrl,
			open,
			setOpen,
			toggle,
			identity,
			identify,
			messages,
			status,
			errorMessage: sendError?.message ?? null,
			errorCode: sendError?.code ?? null,
			draft,
			setDraft,
			replyTo,
			setReplyTo,
			findMessage,
			send,
			conversationId: feed.conversationId,
			refresh,
			escalated,
			escalating,
			escalateFailed,
			canEscalate,
			escalate,
			escalationSummary,
			resolved,
			resolving,
			resolveFailed,
			canResolve,
			resolve,
			rate,
			csatEligible,
			submitCsat,
		}),
		[
			apiKey,
			apiUrl,
			brandColor,
			position,
			resolvedGreeting,
			config.showBranding,
			config.privacyPolicyUrl,
			open,
			setOpen,
			toggle,
			identity,
			identify,
			messages,
			status,
			sendError,
			draft,
			setDraft,
			replyTo,
			setReplyTo,
			findMessage,
			send,
			feed.conversationId,
			refresh,
			escalated,
			escalating,
			escalateFailed,
			canEscalate,
			escalate,
			escalationSummary,
			resolved,
			resolving,
			resolveFailed,
			canResolve,
			resolve,
			rate,
			csatEligible,
			submitCsat,
		],
	);

	return (
		<ClankerSupportContext.Provider value={contextValue}>
			{children}
		</ClankerSupportContext.Provider>
	);
}
