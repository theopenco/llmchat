/**
 * Roles a conversation message can carry. `admin` is a human operator reply
 * sent from the dashboard inbox; `system` rows are internal markers (e.g. the
 * escalation record) that default UIs should not render.
 */
export type MessageRole = "user" | "assistant" | "admin" | "system";

/** Per-message thumbs feedback. `null` = no rating / cleared. */
export type MessageRating = "up" | "down" | null;

/**
 * A message as rendered by the widget — the merge of the persisted server
 * feed (source of truth, includes operator replies) and local in-flight
 * state (the just-sent user message and the streaming assistant reply).
 */
export interface ChatMessage {
	id: string;
	role: MessageRole | (string & {});
	content: string;
	/** Only persisted assistant messages (stable DB id) can be rated. */
	rateable?: boolean;
	rating?: MessageRating;
}

/** Lifecycle of the current send: idle → submitted → streaming → idle | error. */
export type ChatStatus = "idle" | "submitted" | "streaming" | "error";

export interface VisitorIdentity {
	name: string;
	email: string;
}

/** Server-authoritative widget config from `GET /v1/config/:key`. */
export interface WidgetConfig {
	/**
	 * Whether the "Powered by" badge shows — decided by the workspace's plan
	 * server-side so it can't be stripped client-side.
	 */
	showBranding: boolean;
	/** Absolute privacy-policy URL, or null to use the built-in default link. */
	privacyPolicyUrl: string | null;
}

export type WidgetPosition = "bottom-right" | "bottom-left";
