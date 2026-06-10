export interface Conversation {
	id: string;
	name: string | null;
	email: string | null;
	messageCount: number;
	escalatedAt: number | null;
	archivedAt: number | null;
	updatedAt: number;
}

export interface Message {
	id: string;
	role: "user" | "assistant" | "admin";
	content: string;
	sequence: number;
	createdAt: number;
}
