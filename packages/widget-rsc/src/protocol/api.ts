import type { MessageRating, WidgetConfig } from "../types";

/** A persisted message row from `GET /v1/messages`. */
export interface ServerMessage {
	id: string;
	role: string;
	content: string;
	sequence?: number;
	createdAt?: number;
	rating?: MessageRating;
	/**
	 * Quote-reply: the id of the earlier message in this conversation this one
	 * replies to (validated server-side at write time, so it can only ever point at
	 * another message in this same feed). Null/absent when it isn't a reply.
	 */
	replyToMessageId?: string | null;
}

/** The persisted conversation feed from `GET /v1/messages`. */
export interface MessageFeed {
	/** The visitor's conversation id (null until one exists). */
	conversationId: string | null;
	/** Conversation-level CSAT (1–5), null until rated. */
	csatRating: number | null;
	/** When the conversation was escalated to a human, or null. */
	escalatedAt: string | number | null;
	/** When the conversation was resolved/archived, or null. */
	archivedAt: string | number | null;
	messages: ServerMessage[];
}

export const EMPTY_FEED: MessageFeed = {
	conversationId: null,
	csatRating: null,
	escalatedAt: null,
	archivedAt: null,
	messages: [],
};

/** Text part of an outgoing AI SDK UIMessage. */
export interface UIMessageTextPart {
	type: "text";
	text: string;
}

/** The UIMessage shape `POST /v1/chat` expects in its `messages` array. */
export interface OutgoingUIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	parts: UIMessageTextPart[];
}

/**
 * Error from the Clanker Support API, carrying the machine-readable `code`
 * the api returns in its JSON error body (e.g. `subscription_required`,
 * `message_limit_reached`) so custom UIs can branch on it.
 */
export class ClankerApiError extends Error {
	readonly status: number;
	readonly code: string | null;

	constructor(status: number, code: string | null, message: string) {
		super(message);
		this.name = "ClankerApiError";
		this.status = status;
		this.code = code;
	}
}

async function throwIfNotOk(res: Response, label: string): Promise<void> {
	if (res.ok) {
		return;
	}
	let code: string | null = null;
	try {
		const data = (await res.json()) as { error?: unknown };
		if (typeof data.error === "string") {
			code = data.error;
		}
	} catch {
		// Non-JSON error body — status alone will have to do.
	}
	throw new ClankerApiError(
		res.status,
		code,
		`${label} failed: ${res.status}${code ? ` (${code})` : ""}`,
	);
}

function jsonInit(body: unknown, signal?: AbortSignal): RequestInit {
	return {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
		signal,
	};
}

export interface ChatRequest {
	projectKey: string;
	clientId: string;
	name?: string;
	email?: string;
	/**
	 * Quote-reply: the id of an earlier message in this conversation the visitor is
	 * replying to. Top-level (not per-message) because it describes THIS turn — the
	 * one the request is sending. The api validates it against the conversation and
	 * silently ignores anything that doesn't belong, so a stale id is never an error.
	 */
	replyToMessageId?: string;
	messages: OutgoingUIMessage[];
}

/**
 * Start an assistant turn. Resolves with the response body — an AI SDK v6 UI
 * message stream to hand to `readUIMessageStream`. Throws `ClankerApiError`
 * on non-2xx (invalid key, rate limit, `subscription_required`, …).
 */
export async function postChat(
	apiUrl: string,
	body: ChatRequest,
	signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
	const res = await fetch(`${apiUrl}/v1/chat`, jsonInit(body, signal));
	await throwIfNotOk(res, "chat");
	if (!res.body) {
		throw new ClankerApiError(res.status, null, "chat response has no body");
	}
	return res.body;
}

/** GET the persisted conversation feed; empty when none exists yet. */
export async function fetchFeed(
	apiUrl: string,
	projectKey: string,
	clientId: string,
	signal?: AbortSignal,
): Promise<MessageFeed> {
	const params = new URLSearchParams({ projectKey, clientId });
	const res = await fetch(`${apiUrl}/v1/messages?${params}`, { signal });
	await throwIfNotOk(res, "messages");
	const data = (await res.json()) as Partial<MessageFeed>;
	return {
		conversationId: data.conversationId ?? null,
		csatRating: data.csatRating ?? null,
		escalatedAt: data.escalatedAt ?? null,
		archivedAt: data.archivedAt ?? null,
		messages: data.messages ?? [],
	};
}

export interface EscalationRequest {
	projectKey: string;
	clientId: string;
	name?: string;
	email?: string;
	messages: { role: string; content: string }[];
}

/**
 * Ask for a human. Returns the visitor-facing recap carried in the response
 * body — a malformed/empty body collapses to null and must never fail an
 * already-succeeded escalation (only a non-empty string becomes a card).
 */
export async function requestEscalation(
	apiUrl: string,
	body: EscalationRequest,
): Promise<{ summary: string | null }> {
	const res = await fetch(`${apiUrl}/v1/escalate`, jsonInit(body));
	await throwIfNotOk(res, "escalate");
	const data = (await res.json().catch(() => ({}))) as { summary?: unknown };
	const summary = typeof data.summary === "string" ? data.summary.trim() : "";
	return { summary: summary || null };
}

/**
 * Mark the conversation resolved. `resolved: false` is a benign decline (the
 * conversation is escalated — a human owns it); the caller re-polls instead
 * of showing an error.
 */
export async function requestResolve(
	apiUrl: string,
	body: { projectKey: string; clientId: string },
): Promise<{ resolved: boolean }> {
	const res = await fetch(`${apiUrl}/v1/resolve`, jsonInit(body));
	await throwIfNotOk(res, "resolve");
	const data = (await res.json().catch(() => ({}))) as { resolved?: unknown };
	return { resolved: data.resolved === true };
}

/** POST a per-message thumbs rating. `null` clears it. */
export async function rateMessage(
	apiUrl: string,
	body: {
		projectKey: string;
		clientId: string;
		conversationId: string;
		messageId: string;
		rating: MessageRating;
	},
): Promise<void> {
	const res = await fetch(`${apiUrl}/v1/rating`, jsonInit(body));
	await throwIfNotOk(res, "rating");
}

/** POST an end-of-conversation CSAT rating (1–5). */
export async function rateConversation(
	apiUrl: string,
	body: {
		projectKey: string;
		clientId: string;
		conversationId: string;
		rating: number;
	},
): Promise<void> {
	const res = await fetch(`${apiUrl}/v1/csat`, jsonInit(body));
	await throwIfNotOk(res, "csat");
}

/**
 * Fetch the server-authoritative widget config. Returns null on ANY failure —
 * callers fall back to fail-safe defaults (branding shown, built-in privacy
 * link) so a down API can never break the host page. Runs both server-side
 * (the RSC entry prefetches it, passing Next's `revalidate` via `init`) and
 * client-side (when no server config was provided).
 */
export async function fetchWidgetConfig(
	apiUrl: string,
	projectKey: string,
	init?: RequestInit,
): Promise<WidgetConfig | null> {
	try {
		const res = await fetch(
			`${apiUrl}/v1/config/${encodeURIComponent(projectKey)}`,
			init,
		);
		if (!res.ok) {
			return null;
		}
		const data = (await res.json()) as {
			showBranding?: unknown;
			privacyPolicyUrl?: unknown;
		};
		return {
			// Branding is fail-SAFE: only an explicit `false` hides the badge.
			showBranding: data.showBranding !== false,
			privacyPolicyUrl:
				typeof data.privacyPolicyUrl === "string"
					? data.privacyPolicyUrl
					: null,
		};
	} catch {
		return null;
	}
}
