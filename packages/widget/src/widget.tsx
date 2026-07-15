import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { CsatStep } from "./components/CsatStep";
import { EscalationNotice } from "./components/EscalationNotice";
import { EscalationSection } from "./components/EscalationSection";
import { ComposeIcon } from "./components/icons";
import { IdentifyForm } from "./components/IdentifyForm";
import { MessageList } from "./components/MessageList";
import { PoweredBy } from "./components/PoweredBy";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { ReplyingTo } from "./components/ReplyingTo";
import { ResolvedNotice } from "./components/ResolvedNotice";
import { ResolveSection } from "./components/ResolveSection";
import { SuggestedQuestions } from "./components/SuggestedQuestions";
import { WidgetFrame } from "./components/WidgetFrame";
import { rateConversation, shouldPromptCsat } from "./csat";
import { requestEscalation } from "./escalation";
import { requestsHuman } from "./escalation-intent";
import { requestResolve } from "./resolve";
import {
	getOrCreateClientId,
	getStoredIdentity,
	getText,
	rotateClientId,
	setStoredIdentity,
} from "./lib";
import { mergeMessages } from "./messages-sync";
import { rateMessage, useMessageRatings } from "./rating";
import { ShowcaseChat } from "./ShowcaseChat";
import { useEffectiveTheme } from "./theme";
import {
	BACKGROUND_POLL_INTERVAL_MS,
	clearSnapshot,
	countUnread,
	latestSequence,
	readSnapshot,
	sameSnapshot,
	shouldPollInBackground,
	writeSnapshot,
} from "./unread";
import { POLL_INTERVAL_MS, useServerMessages } from "./useServerMessages";
import { useWidgetConfig } from "./widget-config";

import type { DisplayMessage } from "./components/MessageList";
import type { Rating } from "./rating";
import type { WidgetTheme } from "./theme";
import type { ConversationSnapshot } from "./unread";

/** How long the "Thanks!" screen shows before the conversation view returns. */
const CSAT_THANKS_MS = 1200;

/**
 * How long after a send settles the post-stream refetch is retried once. The
 * api persists the assistant row in a waitUntil after the stream closes, so the
 * immediate refetch races that INSERT; one retry a beat later is what makes the
 * unread badge reliable for a bot reply when the visitor closed the panel
 * mid-answer on a non-escalated conversation (no poll runs there — these two
 * requests are the only chance to see the row). Exported for the tests.
 */
export const POST_STREAM_REFRESH_RETRY_MS = 2_500;

/**
 * "live" (default) talks to the real API: conversations are created and
 * persisted, escalation notifies the team. "showcase" is a self-contained
 * demo: local state only, canned replies, no network calls ever.
 */
export type WidgetMode = "showcase" | "live";

/**
 * "bubble" (default) renders the floating launcher; "inline" renders the
 * panel permanently open filling its container — the /embed iframe page or
 * any position:relative wrapper.
 */
export type WidgetLayout = "bubble" | "inline";

interface BaseWidgetProps {
	brandColor: string;
	mode?: WidgetLayout;
	/** Color scheme: "light" (default) | "dark" | "auto" (follows the OS). */
	theme?: WidgetTheme;
}

interface LiveWidgetProps extends BaseWidgetProps {
	widgetMode?: "live";
	projectKey: string;
	apiUrl: string;
	/** Messages before "Talk to a human" appears; falls back to 3. */
	escalationThreshold?: number;
}

interface ShowcaseWidgetProps extends BaseWidgetProps {
	widgetMode: "showcase";
	projectKey?: string;
	apiUrl?: string;
}

export type WidgetProps = LiveWidgetProps | ShowcaseWidgetProps;

export function Widget(props: WidgetProps) {
	if (props.widgetMode === "showcase") {
		return (
			<ShowcaseWidget
				brandColor={props.brandColor}
				mode={props.mode}
				theme={props.theme}
			/>
		);
	}
	return <LiveWidget {...props} />;
}

function ShowcaseWidget({
	brandColor,
	mode = "bubble",
	theme = "light",
}: BaseWidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	const resolvedTheme = useEffectiveTheme(theme);
	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
			theme={resolvedTheme}
			open={open}
			onOpenChange={setOpen}
			badge={<span className="llmchat-demo-badge">Demo mode</span>}
		>
			<ShowcaseChat />
		</WidgetFrame>
	);
}

const DEFAULT_ESCALATION_THRESHOLD = 3;
const SEND_ERROR =
	"Something went wrong sending your message. Please try again.";

/**
 * The configured human-handoff threshold, or the default when it's missing or
 * below 1 (a project must allow at least one message before escalation).
 */
export function resolveEscalationThreshold(value?: number): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 1
		? Math.floor(value)
		: DEFAULT_ESCALATION_THRESHOLD;
}

/**
 * Whether the conversation is escalated to a human — true if escalated this
 * session OR the server feed reports an escalation. Hydrating from the server
 * means a reload keeps the handoff state: the "Talk to a human" CTA stays hidden
 * (so the visitor can't re-fire /v1/escalate) and the notice keeps showing.
 */
export function deriveEscalated(
	sessionEscalated: boolean,
	feedEscalatedAt: string | number | null,
): boolean {
	return sessionEscalated || feedEscalatedAt != null;
}

/**
 * Whether the conversation is resolved — true if resolved this session OR the
 * server feed reports it archived. Hydrating from the server keeps the resolved
 * state across reload: the "Mark resolved" button stays hidden and the resolved
 * notice keeps showing (mirrors deriveEscalated).
 */
export function deriveResolved(
	sessionResolved: boolean,
	feedArchivedAt: string | number | null,
): boolean {
	return sessionResolved || feedArchivedAt != null;
}

function LiveWidget({
	projectKey,
	apiUrl,
	brandColor,
	mode = "bubble",
	theme = "light",
	escalationThreshold,
}: LiveWidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	const resolvedTheme = useEffectiveTheme(theme);
	const [text, setText] = useState("");
	// Hydrate identity from localStorage on first render (lazy init → no flash of
	// the form on reload). The widget mounts client-side only, and getStoredIdentity
	// is failure-safe, so reading storage during init is fine.
	const storedIdentity = useState(() => getStoredIdentity(projectKey))[0];
	const [name, setName] = useState(storedIdentity?.name ?? "");
	const [email, setEmail] = useState(storedIdentity?.email ?? "");
	const [identified, setIdentified] = useState(storedIdentity != null);
	const [escalatedLocal, setEscalatedLocal] = useState(false);
	const [escalating, setEscalating] = useState(false);
	const [escalateFailed, setEscalateFailed] = useState(false);
	const [resolvedLocal, setResolvedLocal] = useState(false);
	const [resolving, setResolving] = useState(false);
	const [resolveFailed, setResolveFailed] = useState(false);
	// Visitor-facing recap returned by /v1/escalate; null = no card (honesty rail).
	const [escalationSummary, setEscalationSummary] = useState<string | null>(
		null,
	);
	const [clientId, setClientId] = useState("");
	// Tab-local read state for the unread badge (sessionStorage, alongside the
	// clientId). Null = nothing to badge and nothing to poll for: no conversation in
	// this tab yet, or a rotated id (a fresh conversation inherits neither).
	const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null);
	// End-of-conversation CSAT screen: "hidden" during chat, "prompt" when the
	// visitor ends a conversation (resolve / start-a-new-one — NEVER on merely
	// closing the panel), "thanks" briefly after a rating.
	const [csatStep, setCsatStep] = useState<"hidden" | "prompt" | "thanks">(
		"hidden",
	);
	const [csatRated, setCsatRated] = useState(false);
	// True while the CSAT prompt is the exit gate of "start a new conversation":
	// once rated/skipped, the conversation resets to a fresh one.
	const [pendingNew, setPendingNew] = useState(false);

	useEffect(() => {
		setClientId(getOrCreateClientId());
		// Prefill from a prior visit (localStorage, per-project, ≤30d) so a returning
		// or reloading visitor skips the IdentifyForm. Convenience only — the server
		// conversation row stays authoritative for the model. getStoredIdentity returns
		// null on empty/expired/malformed, so an absent/stale entry still shows the form.
		const saved = getStoredIdentity(projectKey);
		if (saved) {
			setName(saved.name);
			setEmail(saved.email);
			setIdentified(true);
		}
	}, [projectKey]);

	// Load this tab's read state once the client id resolves — and drop it when the
	// id rotates ("start a new conversation"), since the stored snapshot belongs to
	// the conversation that was just left behind.
	useEffect(() => {
		setSnapshot(clientId ? readSnapshot(projectKey, clientId) : null);
	}, [projectKey, clientId]);

	// Server decides whether the "Powered by" badge shows (plan-gated, tamper-
	// proof) and supplies the project's privacy policy URL, admin-defined
	// starter questions, and whether to ask for the visitor's identity first.
	// Defaults to branded / built-in privacy link / no chips / no identity form
	// until the server says otherwise.
	const {
		showBranding,
		privacyPolicyUrl,
		suggestedQuestions,
		collectIdentity,
		welcomeMessage,
	} = useWidgetConfig(apiUrl, projectKey);
	// The pre-chat name/email form is opt-in per project (collectIdentity).
	// Off (the default), the widget opens straight into the conversation; a
	// stored identity from a prior visit still skips the form when it's on.
	const needsIdentity = collectIdentity && !identified;

	const chat = useMemo(
		() =>
			new Chat({
				transport: new DefaultChatTransport({
					api: `${apiUrl}/v1/chat`,
					body: {
						projectKey,
						clientId,
						// Blank when the identify form is off — omit, not "" (the inbox
						// shows a null name as "Anonymous").
						name: name || undefined,
						email: email || undefined,
					},
				}),
			}),
		[apiUrl, projectKey, clientId, name, email],
	);
	const { messages, sendMessage, status, error } = useChat({ chat });
	const loading = status === "streaming" || status === "submitted";
	const sendFailed = status === "error" && error != null;

	// Keep polling with the panel CLOSED, but only for an escalated, unresolved
	// conversation that exists in this tab — the one case where somebody owes the
	// visitor a reply they'd otherwise never see. Everything else (a fresh pageview
	// above all) makes zero background requests. See unread.ts for the cost model.
	const backgroundPoll = !open && shouldPollInBackground(snapshot);
	// Poll the persisted feed while chatting so admin replies from the
	// dashboard appear without a refresh.
	const {
		serverMessages,
		conversationId,
		csatRating,
		escalatedAt: serverEscalatedAt,
		archivedAt: serverArchivedAt,
		feedClientId,
		refresh,
	} = useServerMessages(
		apiUrl,
		projectKey,
		clientId,
		(open && !needsIdentity) || backgroundPoll,
		open ? POLL_INTERVAL_MS : BACKGROUND_POLL_INTERVAL_MS,
	);
	// Escalated this session OR per the server feed (hydrates on reload so the
	// "Talk to a human" CTA can't reappear and re-fire /v1/escalate).
	const escalated = deriveEscalated(escalatedLocal, serverEscalatedAt);
	// Resolved this session OR per the server feed (hydrates on reload like
	// escalated, so the "Mark resolved" button stays hidden and the notice shows).
	const resolved = deriveResolved(resolvedLocal, serverArchivedAt);

	// ── Unread badge ──────────────────────────────────────────────────
	// Whether the feed in hand actually describes the conversation we're holding.
	// useServerMessages clears its state in its own POST-COMMIT effect, so for one
	// render after the client id rotates ("start a new conversation") the feed still
	// describes the conversation just left behind. Persisting a snapshot from it
	// would staple the NEW id to the OLD conversation — and arm a background poll for
	// a thread that no longer exists, on every pageview, for the life of the tab.
	// Both values come from the same render, so they go stale together and the
	// mismatch is visible.
	const feedIsCurrent = feedClientId !== null && feedClientId === clientId;

	// Keep the tab-local read state in step with the feed.
	useEffect(() => {
		if (!clientId || !feedIsCurrent) {
			// No feed for THIS conversation yet. Leave the stored record alone — on a
			// reload it's the only thing that knows to start polling at all.
			return;
		}
		if (!conversationId) {
			// The server says this visitor has no conversation: they never started one,
			// or an operator deleted it from the inbox. Nothing to badge, nobody left to
			// wait for — forget it, rather than polling a dead thread forever.
			if (snapshot) {
				clearSnapshot(projectKey);
				setSnapshot(null);
			}
			// The session-local flags described the conversation that's now gone. Left
			// set, escalatedLocal would be OR-ed into whatever conversation this tab
			// starts NEXT (deriveEscalated), stamping it escalated and arming the
			// background poll for a thread no human owes a reply on — for the life of
			// the tab. resolvedLocal is the mirror image: it would stamp the successor
			// resolved and silently disarm its badge. (No-ops when already false.)
			setEscalatedLocal(false);
			setResolvedLocal(false);
			return;
		}
		const next: ConversationSnapshot = {
			clientId,
			conversationId,
			escalated,
			resolved,
			// Open panel = the visitor is reading, so the marker rides the head of the
			// thread; closed = it freezes, which is what makes the count mean anything.
			// With no marker at all, nothing has been seen: that state is reached by
			// sending a first message and closing the panel before the first poll
			// lands, so the reply that follows arrived while the panel was shut — which
			// is exactly what there is to badge. (Adopting the head here instead would
			// silently mark it read.)
			lastSeenSequence: open
				? latestSequence(serverMessages)
				: (snapshot?.lastSeenSequence ?? 0),
		};
		if (snapshot && sameSnapshot(snapshot, next)) {
			return;
		}
		writeSnapshot(projectKey, next);
		setSnapshot(next);
	}, [
		clientId,
		projectKey,
		feedIsCurrent,
		conversationId,
		open,
		serverMessages,
		escalated,
		resolved,
		snapshot,
	]);

	// What the launcher badges. Derived from the FEED against the stored marker —
	// never from a stored count — so a reload with the panel closed recomputes it
	// from what the server actually has, and no snapshot means nothing to compare
	// (hence nothing to badge).
	const unreadCount =
		open || !snapshot
			? 0
			: countUnread(serverMessages, snapshot.lastSeenSequence);

	// Per-message thumbs: optimistic, rolling back if the request fails.
	const sendRating = useCallback(
		async (messageId: string, rating: Rating) => {
			if (!conversationId) {
				return;
			}
			await rateMessage(apiUrl, {
				projectKey,
				clientId,
				conversationId,
				messageId,
				rating,
			});
		},
		[apiUrl, projectKey, clientId, conversationId],
	);
	const { rate, effective } = useMessageRatings(sendRating);

	// Refetch as soon as a send settles (stream finished or failed) so the
	// just-persisted exchange replaces the local copy immediately. One delayed
	// retry backs it up: the api persists the assistant row in a waitUntil AFTER
	// the stream closes, so the immediate refetch can be served before that row
	// commits. With the panel open the next foreground poll would paper over the
	// loss — but a visitor who closed the panel mid-answer on a NON-escalated
	// conversation has no poll left, and the badge for the bot's reply hangs on
	// whichever of these two requests sees the row.
	const wasLoading = useRef(false);
	useEffect(() => {
		const settled = wasLoading.current && !loading;
		wasLoading.current = loading;
		if (!settled) {
			return;
		}
		refresh();
		const retry = setTimeout(refresh, POST_STREAM_REFRESH_RETRY_MS);
		return () => clearTimeout(retry);
	}, [loading, refresh]);

	// ── Quote-reply ───────────────────────────────────────────────────
	// The message the visitor is replying to (drives the "Replying to:" bar).
	const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null);
	// The quote attached to the in-flight send, until the AI SDK gives that message
	// an id we can key it by. `sendMessage` doesn't return the message it creates,
	// so it's parked here and claimed by the effect below on the next render.
	const pendingReplyRef = useRef<string | null>(null);
	// Local user message id → quoted message id. Lets the chip render on the sent
	// bubble IMMEDIATELY (the AI SDK's UIMessage has nowhere to carry it); once the
	// feed catches up, the persisted row supplies the server-validated value instead.
	const [localReplies, setLocalReplies] = useState<Record<string, string>>({});
	useEffect(() => {
		const pending = pendingReplyRef.current;
		if (!pending) {
			return;
		}
		const lastUser = messages.findLast((m) => m.role === "user");
		if (lastUser) {
			pendingReplyRef.current = null;
			setLocalReplies((prev) => ({ ...prev, [lastUser.id]: pending }));
		}
	}, [messages]);

	const displayMessages = useMemo(
		() =>
			mergeMessages(
				serverMessages,
				messages.map((m) => ({
					id: m.id,
					role: m.role,
					content: getText(m),
					replyToMessageId: localReplies[m.id] ?? null,
				})),
			).map((m) =>
				m.rateable ? { ...m, rating: effective(m.id, m.rating ?? null) } : m,
			),
		[serverMessages, messages, effective, localReplies],
	);
	// Never keep a pending reply pointed at a message that has left the thread.
	useEffect(() => {
		if (replyTo && !displayMessages.some((m) => m.id === replyTo.id)) {
			setReplyTo(null);
		}
	}, [displayMessages, replyTo]);
	// The agent is mid-action (integration tool call streamed, no text yet) —
	// e.g. booking a call or looking up an order. Drives the "Working on it…"
	// hint so a multi-second tool round-trip doesn't read as a stall.
	const lastStreamed = messages[messages.length - 1];
	const acting =
		loading &&
		lastStreamed?.role === "assistant" &&
		!getText(lastStreamed) &&
		lastStreamed.parts.some(
			(p) => p.type.startsWith("tool-") || p.type === "dynamic-tool",
		);
	const userMessageCount = displayMessages.filter(
		(m) => m.role === "user",
	).length;
	const threshold = resolveEscalationThreshold(escalationThreshold);
	// An explicit "I want a human" from the visitor overrides the message-count
	// threshold — the CTA surfaces immediately instead of making them rephrase
	// until they hit it.
	const requestedHuman = useMemo(
		() =>
			displayMessages.some(
				(m) => m.role === "user" && requestsHuman(m.content),
			),
		[displayMessages],
	);
	// Hide the escalate CTA once escalated OR resolved (resolved wins — terminal).
	const showEscalation =
		!escalated &&
		!resolved &&
		(userMessageCount >= threshold || requestedHuman);

	// A "real exchange" = at least one persisted visitor message and one bot
	// reply. Only then (and only when not already rated) do we prompt on close.
	const hasRealExchange =
		serverMessages.some((m) => m.role === "user") &&
		serverMessages.some((m) => m.role === "assistant");
	// Offer "Mark resolved" once there's a real exchange and the conversation is
	// neither escalated (Decision B — the operator closes escalated chats) nor
	// already resolved.
	const showResolve = !escalated && !resolved && hasRealExchange;
	const csatEligible = shouldPromptCsat({
		hasRealExchange,
		alreadyRated: csatRating != null || csatRated,
	});

	// Reset to a brand-new conversation: rotate the client id (the old
	// conversation stays intact server-side for the inbox) and clear every
	// per-conversation flag. The fresh greeting + suggestion chips return.
	function resetConversation() {
		setPendingNew(false);
		setCsatStep("hidden");
		setCsatRated(false);
		setEscalatedLocal(false);
		setEscalateFailed(false);
		setResolvedLocal(false);
		setResolveFailed(false);
		setEscalationSummary(null);
		setText("");
		setClientId(rotateClientId());
	}

	// The visitor wants a fresh conversation. Ending one is the CSAT moment —
	// prompt when eligible (real exchange, not yet rated); otherwise reset
	// immediately.
	function startNewConversation() {
		if (csatEligible) {
			setPendingNew(true);
			setCsatStep("prompt");
			return;
		}
		resetConversation();
	}

	// Closing the panel just closes it — never a feedback ambush. If a CSAT
	// prompt was pending (the visitor was mid "end conversation"), closing counts
	// as skipping it: finish the reset so reopening starts fresh.
	function handleOpenChange(next: boolean) {
		if (!next) {
			if (pendingNew) {
				resetConversation();
			} else {
				setCsatStep("hidden");
			}
		}
		setOpen(next);
	}

	function submitCsat(rating: number) {
		setCsatRated(true);
		setCsatStep("thanks");
		// Best-effort: a failed POST must never trap the visitor — we move on anyway.
		if (conversationId) {
			void rateConversation(apiUrl, {
				projectKey,
				clientId,
				conversationId,
				rating,
			}).catch(() => {});
		}
		const startFresh = pendingNew;
		setTimeout(() => {
			if (startFresh) {
				resetConversation();
			} else {
				setCsatStep("hidden");
			}
		}, CSAT_THANKS_MS);
	}

	function skipCsat() {
		if (pendingNew) {
			resetConversation();
			return;
		}
		setCsatStep("hidden");
	}

	function handleSend() {
		// Per-TURN body, not the transport's static body: the quote describes this
		// message only. The api re-validates the id against the conversation and
		// silently drops it if it doesn't belong, so a stale id just sends a plain
		// message. Cleared here so the next turn isn't sent as another reply.
		const quoted = replyTo;
		pendingReplyRef.current = quoted?.id ?? null;
		setReplyTo(null);
		void sendMessage(
			{ text: text.trim() },
			quoted ? { body: { replyToMessageId: quoted.id } } : undefined,
		);
		setText("");
	}

	async function handleEscalate() {
		if (escalating) {
			return;
		}
		setEscalating(true);
		setEscalateFailed(false);
		try {
			const { summary } = await requestEscalation(apiUrl, {
				projectKey,
				clientId,
				name: name || undefined,
				email: email || undefined,
				messages: displayMessages.map(({ role, content }) => ({
					role,
					content,
				})),
			});
			setEscalationSummary(summary);
			setEscalatedLocal(true);
			refresh();
		} catch {
			setEscalateFailed(true);
		} finally {
			setEscalating(false);
		}
	}

	async function handleResolve() {
		if (resolving) {
			return;
		}
		setResolving(true);
		setResolveFailed(false);
		try {
			const { resolved: didResolve } = await requestResolve(apiUrl, {
				projectKey,
				clientId,
			});
			// didResolve === false = the server declined (escalated — Decision B);
			// don't flip local resolved, just re-poll so the escalated state surfaces.
			if (didResolve) {
				setResolvedLocal(true);
				// Resolving ends the conversation — that's the feedback moment
				// (never the panel close). Prompt when eligible; rating/skip returns
				// to the resolved view, it doesn't reset the conversation.
				if (csatEligible) {
					setCsatStep("prompt");
				}
			}
			refresh();
		} catch {
			setResolveFailed(true);
		} finally {
			setResolving(false);
		}
	}

	// Header shortcut to end the current conversation and start fresh — only
	// once there's a conversation worth leaving (or a terminal state to escape).
	const canStartNew =
		!needsIdentity &&
		csatStep === "hidden" &&
		(hasRealExchange || resolved || escalated);

	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
			theme={resolvedTheme}
			open={open}
			onOpenChange={handleOpenChange}
			unreadCount={unreadCount}
			actions={
				canStartNew ? (
					<button
						type="button"
						className="llmchat-icon-btn"
						onClick={startNewConversation}
						aria-label="Start a new conversation"
						title="Start a new conversation"
					>
						<ComposeIcon />
					</button>
				) : undefined
			}
			footer={showBranding ? <PoweredBy /> : null}
		>
			{csatStep !== "hidden" ? (
				<CsatStep step={csatStep} onRate={submitCsat} onSkip={skipCsat} />
			) : needsIdentity ? (
				<IdentifyForm
					name={name}
					email={email}
					onNameChange={setName}
					onEmailChange={setEmail}
					onSubmit={() => {
						// Remember for next visit (IdentifyForm already blocks an empty name).
						setStoredIdentity(projectKey, { name, email });
						setIdentified(true);
					}}
				/>
			) : (
				<>
					<MessageList
						greeting={
							// The operator's configured welcomeMessage wins once the server
							// config resolves; until then (or if unset) fall back to the
							// built-in default, personalized when we already know the name.
							welcomeMessage?.trim() ||
							(name ? `Hi ${name}! How can I help?` : "Hi! How can I help?")
						}
						messages={displayMessages}
						typing={loading}
						acting={acting}
						error={sendFailed ? SEND_ERROR : null}
						onRate={conversationId ? rate : undefined}
						onReply={setReplyTo}
					/>
					{showEscalation && (
						<EscalationSection
							pending={escalating}
							failed={escalateFailed}
							onEscalate={handleEscalate}
						/>
					)}
					{/* Starter-question chips until the visitor's first message. */}
					{userMessageCount === 0 && !loading && (
						<SuggestedQuestions
							questions={suggestedQuestions}
							onPick={(q) => void sendMessage({ text: q })}
						/>
					)}
					{showResolve && (
						<ResolveSection
							pending={resolving}
							failed={resolveFailed}
							onResolve={handleResolve}
						/>
					)}
					{/* Resolved wins (terminal) over the escalation notice. */}
					{resolved ? (
						<ResolvedNotice onStartNew={startNewConversation} />
					) : (
						escalated && <EscalationNotice summary={escalationSummary} />
					)}
					{/* Consent line above the composer — shown until the visitor's first
					    message, then it vanishes for the rest of the conversation. */}
					{userMessageCount === 0 && (
						<PrivacyNotice privacyPolicyUrl={privacyPolicyUrl} />
					)}
					{replyTo && (
						<ReplyingTo message={replyTo} onDismiss={() => setReplyTo(null)} />
					)}
					<Composer
						value={text}
						disabled={loading}
						onChange={setText}
						onSubmit={handleSend}
					/>
				</>
			)}
		</WidgetFrame>
	);
}
