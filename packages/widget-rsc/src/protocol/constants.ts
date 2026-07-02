/** Hosted Clanker Support API. Self-hosters pass their own `apiUrl`. */
export const DEFAULT_API_URL = "https://api.clankersupport.com";

/**
 * The static, automated acknowledgement the API streams IN PLACE of an AI
 * reply when the visitor messages a conversation that's escalated to a human.
 * The merge logic recognizes it to anchor the (never-persisted) holding bubble
 * in chronological order.
 *
 * KEEP IN SYNC with `@llmchat/shared/holding` (`ESCALATED_HOLDING_MESSAGE`) in
 * github.com/theopenco/llmchat — duplicated here because this package is
 * published standalone and cannot depend on the private workspace package.
 */
export const ESCALATED_HOLDING_MESSAGE =
	"This is an automated message. Thanks — your reply has been added to the conversation and our support team will follow up here. Feel free to keep adding details in the meantime.";
