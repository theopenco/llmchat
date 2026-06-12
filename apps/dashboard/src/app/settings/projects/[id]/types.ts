export interface Project {
	id: string;
	name: string;
	publicKey: string;
	systemPrompt: string;
	activeSystemPromptId: string | null;
	knowledgeText: string;
	model: string;
	brandColor: string;
	welcomeMessage: string;
	escalationThreshold: number;
	notifyEmail: string | null;
	slackWebhookUrl: string | null;
}

export interface Source {
	id: string;
	projectId: string;
	url: string;
	title: string;
	content: string;
	active: boolean;
	lastFetchedAt: string | null;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

/** The subset of project fields editable on this page. */
export type ProjectDraft = Pick<
	Project,
	"name" | "welcomeMessage" | "brandColor" | "model" | "systemPrompt"
>;

export const INSTRUCTION_TEMPLATES = {
	support: `You are a helpful customer support assistant for our website. Answer questions based on the provided sources. Be friendly, concise and professional. If you don't know the answer, suggest contacting our support team.`,
	ecommerce: `You are a shopping assistant for our online store. Help visitors find products, compare options, and answer questions about shipping, returns, and order status using the provided sources. Be upbeat and persuasive without being pushy. If something isn't covered, point them to our support team.`,
} as const;
