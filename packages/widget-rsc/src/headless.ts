/**
 * Headless entry — everything you need to build your own support chat UI on
 * top of the Clanker Support API, unstyled.
 *
 *   "use client";
 *   import * as SupportChat from "@clankersupport/widget-rsc/headless";
 *
 *   <SupportChat.Root apiKey="…">
 *     <SupportChat.Trigger>Need help?</SupportChat.Trigger>
 *     <SupportChat.Panel>
 *       <SupportChat.Messages />
 *       <SupportChat.Composer>
 *         <SupportChat.Input />
 *         <SupportChat.Submit>Send</SupportChat.Submit>
 *       </SupportChat.Composer>
 *     </SupportChat.Panel>
 *   </SupportChat.Root>
 *
 * Or drop below components entirely and drive everything through the
 * `useClankerSupport()` hook.
 */
export {
	ClankerSupportProvider,
	resolveEscalationThreshold,
} from "./client/provider";
export type { ClankerSupportProviderProps } from "./client/provider";
export { useClankerSupport } from "./client/context";
export type { ClankerSupportContextValue } from "./client/context";
export {
	Branding,
	Composer,
	EscalateButton,
	Input,
	MISSING_QUOTE_LABEL,
	Messages,
	PANEL_ID,
	Panel,
	QuotedMessage,
	ReplyButton,
	ReplyingTo,
	ResolveButton,
	Root,
	Submit,
	Trigger,
} from "./primitives/primitives";
export { ClankerSupportWidget } from "./default/widget";
export type { ClankerSupportWidgetProps } from "./default/widget";
export { widgetStyles } from "./default/styles";
export { ClankerApiError, fetchWidgetConfig } from "./protocol/api";
export type { MessageFeed, ServerMessage } from "./protocol/api";
// Unread-badge display helpers for custom UIs ("9+" cap, accessible launcher
// name). The count itself is `unreadCount` on the context; the poll lifecycle
// behind it is provider-internal.
export { badgeLabel, launcherLabel } from "./protocol/unread";
export { DEFAULT_API_URL } from "./protocol/constants";
export type {
	ChatMessage,
	ChatStatus,
	MessageRating,
	MessageRole,
	VisitorIdentity,
	WidgetConfig,
	WidgetPosition,
} from "./types";
