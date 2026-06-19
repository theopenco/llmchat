import { z } from "zod";

export * from "./analytics";
export {
	CONSENT_STORAGE_KEY,
	type ConsentValue,
	getStoredConsent,
	isConsentRequiredRegion,
	setStoredConsent,
} from "./consent";
export { resolveSiblingUrl } from "./preview-url";
export {
	DEFAULT_MODEL,
	effectiveModel,
	isWebSearchModel,
	WEB_SEARCH_MODEL_IDS,
	WEB_SEARCH_MODELS,
} from "./models";

export const widgetMessageRole = z.enum(["user", "assistant", "admin"]);

export const widgetMessage = z.object({
	id: z.string(),
	role: widgetMessageRole,
	content: z.string(),
	createdAt: z.iso.datetime().optional(),
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
