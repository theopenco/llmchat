import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Composer } from "./components/Composer";
import { CsatStep } from "./components/CsatStep";
import { EscalationNotice } from "./components/EscalationNotice";
import { EscalationSection } from "./components/EscalationSection";
import { IdentifyForm } from "./components/IdentifyForm";
import { MessageList } from "./components/MessageList";
import { PoweredBy } from "./components/PoweredBy";
import { ResolvedNotice } from "./components/ResolvedNotice";
import { ResolveSection } from "./components/ResolveSection";
import { WidgetFrame } from "./components/WidgetFrame";
import { rateConversation, shouldPromptCsat } from "./csat";
import { requestEscalation } from "./escalation";
import { requestResolve } from "./resolve";
import {
	getOrCreateClientId,
	getStoredIdentity,
	getText,
	setStoredIdentity,
} from "./lib";
import { mergeMessages } from "./messages-sync";
import { rateMessage, useMessageRatings } from "./rating";
import { ShowcaseChat } from "./ShowcaseChat";
import { useServerMessages } from "./useServerMessages";
import { useShowBranding } from "./widget-config";

import type { Rating } from "./rating";

/** How long the "Thanks!" screen shows before the panel closes. */
const CSAT_THANKS_MS = 1200;

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
		return <ShowcaseWidget brandColor={props.brandColor} mode={props.mode} />;
	}
	return <LiveWidget {...props} />;
}

function ShowcaseWidget({ brandColor, mode = "bubble" }: BaseWidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
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
	escalationThreshold,
}: LiveWidgetProps) {
	const inline = mode === "inline";
	const [open, setOpen] = useState(inline);
	const [text, setText] = useState("");
	// Hydrate identity from localStorage on first render (lazy init → no flash of
	// the form on reload). The widget mounts client-side only, and getStoredIdentity
	// is failure-safe, so reading storage during init is fine.
	const storedIdentity = useState(() => getStoredIdentity())[0];
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
	// CSAT closing screen: "hidden" during chat, "prompt" on close (when
	// eligible), "thanks" briefly after a rating.
	const [csatStep, setCsatStep] = useState<"hidden" | "prompt" | "thanks">(
		"hidden",
	);
	const [csatRated, setCsatRated] = useState(false);

	useEffect(() => {
		setClientId(getOrCreateClientId());
	}, []);

	// Server decides whether the "Powered by" badge shows (plan-gated, tamper-
	// proof). Defaults to shown until the server says otherwise.
	const showBranding = useShowBranding(apiUrl, projectKey);

	const chat = useMemo(
		() =>
			new Chat({
				transport: new DefaultChatTransport({
					api: `${apiUrl}/v1/chat`,
					body: { projectKey, clientId, name, email: email || undefined },
				}),
			}),
		[apiUrl, projectKey, clientId, name, email],
	);
	const { messages, sendMessage, status, error } = useChat({ chat });
	const loading = status === "streaming" || status === "submitted";
	const sendFailed = status === "error" && error != null;

	// Poll the persisted feed while chatting so admin replies from the
	// dashboard appear without a refresh.
	const {
		serverMessages,
		conversationId,
		csatRating,
		escalatedAt: serverEscalatedAt,
		archivedAt: serverArchivedAt,
		refresh,
	} = useServerMessages(apiUrl, projectKey, clientId, open && identified);
	// Escalated this session OR per the server feed (hydrates on reload so the
	// "Talk to a human" CTA can't reappear and re-fire /v1/escalate).
	const escalated = deriveEscalated(escalatedLocal, serverEscalatedAt);
	// Resolved this session OR per the server feed (hydrates on reload like
	// escalated, so the "Mark resolved" button stays hidden and the notice shows).
	const resolved = deriveResolved(resolvedLocal, serverArchivedAt);

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
	// just-persisted exchange replaces the local copy immediately.
	const wasLoading = useRef(false);
	useEffect(() => {
		if (wasLoading.current && !loading) {
			refresh();
		}
		wasLoading.current = loading;
	}, [loading, refresh]);

	const displayMessages = useMemo(
		() =>
			mergeMessages(
				serverMessages,
				messages.map((m) => ({ id: m.id, role: m.role, content: getText(m) })),
			).map((m) =>
				m.rateable ? { ...m, rating: effective(m.id, m.rating ?? null) } : m,
			),
		[serverMessages, messages, effective],
	);
	const userMessageCount = displayMessages.filter(
		(m) => m.role === "user",
	).length;
	const threshold = resolveEscalationThreshold(escalationThreshold);
	// Hide the escalate CTA once escalated OR resolved (resolved wins — terminal).
	const showEscalation =
		!escalated && !resolved && userMessageCount >= threshold;

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

	// Intercept close: when eligible, swap to the CSAT step instead of closing.
	// A second close (X / Esc / Skip) always closes — never traps the visitor.
	function handleOpenChange(next: boolean) {
		if (!next && csatStep === "hidden" && csatEligible) {
			setCsatStep("prompt");
			return;
		}
		if (!next) {
			setCsatStep("hidden");
		}
		setOpen(next);
	}

	function submitCsat(rating: number) {
		setCsatRated(true);
		setCsatStep("thanks");
		// Best-effort: a failed POST must never trap the visitor — we close anyway.
		if (conversationId) {
			void rateConversation(apiUrl, {
				projectKey,
				clientId,
				conversationId,
				rating,
			}).catch(() => {});
		}
		setTimeout(() => {
			setCsatStep("hidden");
			setOpen(false);
		}, CSAT_THANKS_MS);
	}

	function skipCsat() {
		setCsatStep("hidden");
		setOpen(false);
	}

	function handleSend() {
		void sendMessage({ text: text.trim() });
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
				name,
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
			}
			refresh();
		} catch {
			setResolveFailed(true);
		} finally {
			setResolving(false);
		}
	}

	return (
		<WidgetFrame
			inline={inline}
			brandColor={brandColor}
			open={open}
			onOpenChange={handleOpenChange}
			footer={showBranding ? <PoweredBy /> : null}
		>
			{csatStep !== "hidden" ? (
				<CsatStep step={csatStep} onRate={submitCsat} onSkip={skipCsat} />
			) : !identified ? (
				<IdentifyForm
					name={name}
					email={email}
					onNameChange={setName}
					onEmailChange={setEmail}
					onSubmit={() => {
						// Persist so a reload skips the form (the conversation itself
						// already survives via the sessionStorage clientId).
						setStoredIdentity({ name: name.trim(), email: email.trim() });
						setIdentified(true);
					}}
				/>
			) : (
				<>
					<MessageList
						greeting={`Hi ${name}! How can I help?`}
						messages={displayMessages}
						typing={loading}
						error={sendFailed ? SEND_ERROR : null}
						onRate={conversationId ? rate : undefined}
					/>
					{showEscalation && (
						<EscalationSection
							pending={escalating}
							failed={escalateFailed}
							onEscalate={handleEscalate}
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
						<ResolvedNotice />
					) : (
						escalated && <EscalationNotice summary={escalationSummary} />
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
