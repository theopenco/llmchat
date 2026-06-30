/**
 * The static, automated acknowledgement a visitor sees IN PLACE of an AI reply
 * when they message a conversation that's escalated to a human. Clearly labelled
 * automated and promises no timeline (honesty rail).
 *
 * Lives in @llmchat/shared (exposed via the narrow `@llmchat/shared/holding`
 * subpath, NOT the barrel) so it's the single source of truth shared by the api
 * (which streams it) and the widget (which recognizes it to anchor the holding
 * bubble in chronological order). The subpath keeps the lean widget IIFE bundle
 * from pulling the barrel's models snapshot + its import-time validation.
 */
export const ESCALATED_HOLDING_MESSAGE =
	"This is an automated message. Thanks — your reply has been added to the conversation and our support team will follow up here. Feel free to keep adding details in the meantime.";
