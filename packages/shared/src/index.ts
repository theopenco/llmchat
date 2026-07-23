import { z } from "zod";

export * from "./analytics";
export * from "./integrations";
export {
	CONSENT_STORAGE_KEY,
	type ConsentValue,
	getStoredConsent,
	isConsentRequiredRegion,
	setStoredConsent,
} from "./consent";
export { resolveSiblingUrl } from "./preview-url";
export { TAG_PALETTE, type TagColor, isPaletteColor } from "./tag-colors";
export {
	DEFAULT_MODEL,
	effectiveModel,
	isBasicModel,
	isWebSearchModel,
	WEB_SEARCH_MODEL_IDS,
	WEB_SEARCH_MODELS,
} from "./models";
export {
	BILLING_TIERS,
	ENTERPRISE_TIER,
	INTERNAL_ENTITLEMENTS,
	PAID_PLANS,
	TRIAL_PERIOD_DAYS,
	UNLIMITED,
	isInternalEmail,
	isModelAllowed,
	isOverResponseQuota,
	isPaidPlan,
	isUnlimited,
	isWithinLimit,
	planEntitlements,
	showPoweredByBadge,
	type BillingInterval,
	type Plan,
	type PaidPlan,
	type TierEntitlements,
} from "./billing-tiers";

// ─── Message-role allowlists ────────────────────────────────────────────────
// ALL FOUR role allowlists live side by side, on purpose: a new message role
// gets judged against every boundary in one place, and stays invisible on all
// of them until it is deliberately added. Each guards a different edge:
//   VISITOR_VISIBLE_ROLES — what may LEAVE the operator dashboard
//   RECAP_ROLES           — what the visitor-facing escalation recap summarizes
//   HISTORY_ROLES         — what a visitor may SUBMIT as /v1/chat history
//   QUOTABLE_ROLES        — what a visitor may quote-reply

/** Roles allowed to leave the operator dashboard, incl. email. Everything not
 * listed (e.g. the operator-internal "note") must never reach a visitor
 * surface: the widget feed (/v1/messages), the escalation notification email's
 * transcript, or the inbox triage summary prompt. ALLOWLIST on purpose — a
 * future role is hidden until it is deliberately added here. */
export const VISITOR_VISIBLE_ROLES = [
	"user",
	"assistant",
	"admin",
	"system",
] as const;
export type VisitorVisibleRole = (typeof VISITOR_VISIBLE_ROLES)[number];
export function isVisitorVisibleRole(role: string): role is VisitorVisibleRole {
	return (VISITOR_VISIBLE_ROLES as readonly string[]).includes(role);
}

/** Roles summarized into the VISITOR-facing escalation recap. Excludes
 * `system` (the escalation marker is an event, not conversation content —
 * preserving the recap's historical behavior) and, like every role allowlist,
 * hides future roles by default. */
export const RECAP_ROLES = ["user", "assistant", "admin"] as const;
export type RecapRole = (typeof RECAP_ROLES)[number];
export function isRecapRole(role: string): role is RecapRole {
	return (RECAP_ROLES as readonly string[]).includes(role);
}

/** History roles a visitor may SUBMIT to /v1/chat: their own turns and prior
 * bot replies — the inbound counterpart of the outbound lists above. `system`
 * is REJECTED — the server owns the system prompt, and a client-supplied
 * system turn would reach the model as fabricated authority. Anything else
 * (admin/note/junk) was never legitimate history; rejecting at the schema
 * turns what used to be a convertToModelMessages 502 into a clean 400. Both
 * official transports already comply: the widget's useChat state only ever
 * holds the visitor's turns + streamed replies, and the RSC provider filters
 * to user/assistant before POSTing (packages/widget-rsc/src/client/provider.tsx). */
export const HISTORY_ROLES = ["user", "assistant"] as const;

/** The message roles a visitor may quote-reply — an ALLOWLIST, not a denylist.
 * `system` is excluded on purpose: those rows are internal markers ("Visitor
 * requested a human operator") that the widget never displays, so re-surfacing
 * one into the prompt would be a net-new injection/leak channel rather than a
 * reply to something the visitor actually saw. */
export const QUOTABLE_ROLES = ["user", "assistant", "admin"] as const;
export type QuotableRole = (typeof QUOTABLE_ROLES)[number];
export function isQuotableRole(role: string): role is QuotableRole {
	return (QUOTABLE_ROLES as readonly string[]).includes(role);
}

// `system` rows (the escalation marker) are part of the served feed, so the
// wire type names them; the operator-internal `note` role must NEVER be added
// here — this enum defines what a visitor may see.
export const widgetMessageRole = z.enum([
	"user",
	"assistant",
	"admin",
	"system",
]);

export const widgetMessage = z.object({
	id: z.string(),
	role: widgetMessageRole,
	content: z.string(),
	createdAt: z.iso.datetime().optional(),
	// Quote-reply: the id of an earlier message in the same conversation this one
	// replies to. Nullish — absent on messages sent before the feature, null on
	// every message that isn't a reply. Clients resolve it against the loaded
	// thread and fall back to a neutral chip when the target isn't in the window.
	replyToMessageId: z.string().nullish(),
});
export type WidgetMessage = z.infer<typeof widgetMessage>;

export const projectConfig = z.object({
	id: z.string(),
	name: z.string(),
	publicKey: z.string(),
	systemPrompt: z.string(),
	knowledgeText: z.string(),
	model: z.string(),
	brandColor: z.string(),
	welcomeMessage: z.string(),
	escalationThreshold: z.number().int(),
});
export type ProjectConfig = z.infer<typeof projectConfig>;

export const conversationSummary = z.object({
	id: z.string(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	messageCount: z.number().int(),
	escalatedAt: z.string().nullable(),
	archivedAt: z.string().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type ConversationSummary = z.infer<typeof conversationSummary>;
