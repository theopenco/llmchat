"use client";

import { createContext, useContext } from "react";

import type {
	ChatMessage,
	ChatStatus,
	VisitorIdentity,
	WidgetPosition,
} from "../types";

/**
 * Everything the headless primitives (and your own components) can read or
 * drive. Obtain it with `useClankerSupport()` anywhere below
 * `<ClankerSupportProvider>` / `<Root>`.
 */
export interface ClankerSupportContextValue {
	// ── Static config ────────────────────────────────────────────────
	apiKey: string;
	apiUrl: string;
	brandColor: string;
	position: WidgetPosition;
	/** Local-only greeting bubble copy, or null to render none. */
	greeting: string | null;

	// ── Server-authoritative config ──────────────────────────────────
	/** Plan-gated "Powered by" flag; fail-safe true until the server says otherwise. */
	showBranding: boolean;
	privacyPolicyUrl: string | null;

	// ── Panel state ──────────────────────────────────────────────────
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;

	// ── Visitor identity ─────────────────────────────────────────────
	/** Saved name/email, or null when the visitor hasn't identified yet. */
	identity: VisitorIdentity | null;
	/** Persist the visitor's identity (name required; empty names are ignored). */
	identify: (identity: VisitorIdentity) => void;

	// ── Conversation ─────────────────────────────────────────────────
	/** Merged display messages: persisted feed + local in-flight, in order. */
	messages: ChatMessage[];
	status: ChatStatus;
	/** Friendly copy for the last failed send, or null. */
	errorMessage: string | null;
	/** Machine-readable api code for the last failed send (e.g. `subscription_required`). */
	errorCode: string | null;
	/** Composer draft (shared so Input/Submit/your components stay in sync). */
	draft: string;
	setDraft: (value: string) => void;

	// ── Quote-reply ──────────────────────────────────────────────────
	/**
	 * The earlier message the visitor is replying to, or null. Set it to show the
	 * "Replying to:" bar above the composer; the next `send` attaches it and clears
	 * it. Only user/assistant/admin messages are quotable — `system` rows are
	 * internal markers and `replyTo` ignores them (the api ignores them too).
	 */
	replyTo: ChatMessage | null;
	setReplyTo: (message: ChatMessage | null) => void;
	/** Resolve a `replyToMessageId` against the loaded thread; null when out of window. */
	findMessage: (id: string) => ChatMessage | null;

	/** Send `text` (or the current draft when omitted). No-op while busy or empty. */
	send: (text?: string) => Promise<void>;
	conversationId: string | null;
	/** Re-poll the persisted feed immediately. */
	refresh: () => void;

	// ── Human handoff ────────────────────────────────────────────────
	escalated: boolean;
	escalating: boolean;
	escalateFailed: boolean;
	/** True once the visitor may ask for a human (threshold reached, not yet escalated/resolved). */
	canEscalate: boolean;
	escalate: () => Promise<void>;
	/** Visitor-facing recap returned by the escalation, or null when none. */
	escalationSummary: string | null;
	resolved: boolean;
	resolving: boolean;
	resolveFailed: boolean;
	/** True once the visitor may mark the conversation resolved. */
	canResolve: boolean;
	resolve: () => Promise<void>;

	// ── Feedback ─────────────────────────────────────────────────────
	/** Toggle a thumbs rating on a persisted assistant message (optimistic). */
	rate: (messageId: string, intent: "up" | "down") => Promise<void>;
	/** Whether a CSAT prompt makes sense now (real exchange, not yet rated). */
	csatEligible: boolean;
	/** Submit an end-of-conversation CSAT rating (1–5). Best-effort. */
	submitCsat: (rating: number) => Promise<void>;
}

export const ClankerSupportContext =
	createContext<ClankerSupportContextValue | null>(null);

/**
 * Read the widget state and actions. Must be used inside
 * `<ClankerSupportProvider>` (exported as `Root` from
 * `@clankersupport/widget-rsc/headless`).
 */
export function useClankerSupport(): ClankerSupportContextValue {
	const ctx = useContext(ClankerSupportContext);
	if (!ctx) {
		throw new Error(
			"useClankerSupport must be used inside <ClankerSupportProvider> (Root from @clankersupport/widget-rsc/headless)",
		);
	}
	return ctx;
}
