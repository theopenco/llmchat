import { sql } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
	text()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const timestamp = () => integer({ mode: "timestamp" });

const createdAt = () =>
	timestamp()
		.notNull()
		.default(sql`(unixepoch())`);

// ─── Better Auth ──────────────────────────────────────────────────────────

export const user = sqliteTable("user", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: integer({ mode: "boolean" }).notNull().default(false),
	image: text(),
	createdAt: createdAt(),
	updatedAt: timestamp()
		.notNull()
		.default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	token: text().notNull().unique(),
	expiresAt: timestamp().notNull(),
	ipAddress: text(),
	userAgent: text(),
	createdAt: createdAt(),
	updatedAt: timestamp()
		.notNull()
		.default(sql`(unixepoch())`),
});

export const account = sqliteTable("account", {
	id: text().primaryKey(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accountId: text().notNull(),
	providerId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp(),
	refreshTokenExpiresAt: timestamp(),
	scope: text(),
	password: text(),
	createdAt: createdAt(),
	updatedAt: timestamp()
		.notNull()
		.default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
	id: text().primaryKey(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp().notNull(),
	createdAt: createdAt(),
	updatedAt: timestamp()
		.notNull()
		.default(sql`(unixepoch())`),
});

export const passkey = sqliteTable("passkey", {
	id: text().primaryKey(),
	name: text(),
	publicKey: text().notNull(),
	userId: text()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	credentialID: text().notNull(),
	counter: integer().notNull(),
	deviceType: text().notNull(),
	backedUp: integer({ mode: "boolean" }).notNull(),
	transports: text(),
	createdAt: createdAt(),
});

// ─── Workspaces / Projects ────────────────────────────────────────────────

export const workspace = sqliteTable("workspace", {
	id: id(),
	name: text().notNull(),
	ownerId: text()
		.notNull()
		.references(() => user.id),
	stripeCustomerId: text(),
	stripeSubscriptionId: text(),
	plan: text({ enum: ["free", "pro", "scale"] })
		.notNull()
		.default("free"),
	createdAt: createdAt(),
});

export const member = sqliteTable(
	"member",
	{
		id: id(),
		workspaceId: text()
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text({ enum: ["owner", "admin", "agent"] })
			.notNull()
			.default("agent"),
		createdAt: createdAt(),
	},
	(t) => [uniqueIndex("member_workspace_user").on(t.workspaceId, t.userId)],
);

export const project = sqliteTable(
	"project",
	{
		id: id(),
		workspaceId: text()
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		name: text().notNull(),
		publicKey: text().notNull().unique(),
		systemPrompt: text().notNull().default(""),
		activeSystemPromptId: text(),
		favorite: integer({ mode: "boolean" }).notNull().default(false),
		pinned: integer({ mode: "boolean" }).notNull().default(false),
		// Plain-text knowledge base for v1; replaced by RAG later.
		knowledgeText: text().notNull().default(""),
		model: text().notNull().default("gpt-4o-search-preview"),
		brandColor: text().notNull().default("#000000"),
		welcomeMessage: text().notNull().default("Hi! How can I help you today?"),
		escalationThreshold: integer().notNull().default(3),
		notifyEmail: text(),
		slackWebhookUrl: text(),
		// Local part for inbound email replies: reply+<inboundEmailLocal>@domain
		inboundEmailLocal: text().notNull().unique(),
		createdAt: createdAt(),
	},
	(t) => [index("project_workspace").on(t.workspaceId)],
);

// ─── Conversations ────────────────────────────────────────────────────────

export const conversation = sqliteTable(
	"conversation",
	{
		id: id(),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		clientId: text().notNull(),
		name: text(),
		email: text(),
		ipAddress: text(),
		userAgent: text(),
		messageCount: integer().notNull().default(0),
		escalatedAt: timestamp(),
		archivedAt: timestamp(),
		createdAt: createdAt(),
		updatedAt: timestamp()
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("conversation_inbox").on(t.projectId, t.archivedAt, t.updatedAt),
		index("conversation_client").on(t.projectId, t.clientId),
	],
);

export const systemPrompt = sqliteTable(
	"system_prompt",
	{
		id: id(),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		name: text().notNull(),
		content: text().notNull().default(""),
		favorite: integer({ mode: "boolean" }).notNull().default(false),
		createdAt: createdAt(),
		updatedAt: timestamp()
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("system_prompt_project").on(t.projectId)],
);

export const source = sqliteTable(
	"source",
	{
		id: id(),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		url: text().notNull(),
		title: text().notNull().default(""),
		content: text().notNull().default(""),
		active: integer({ mode: "boolean" }).notNull().default(true),
		lastFetchedAt: timestamp(),
		lastError: text(),
		createdAt: createdAt(),
		updatedAt: timestamp()
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("source_project").on(t.projectId)],
);

export const message = sqliteTable(
	"message",
	{
		id: id(),
		conversationId: text()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		role: text({ enum: ["user", "assistant", "admin", "system"] }).notNull(),
		content: text().notNull(),
		sequence: integer().notNull(),
		// Author for admin messages; null for user/assistant.
		authorUserId: text().references(() => user.id),
		// RFC 5322 Message-ID for outbound email threading + inbound matching.
		emailMessageId: text(),
		createdAt: createdAt(),
	},
	(t) => [
		index("message_conv_seq").on(t.conversationId, t.sequence),
		index("message_email_id").on(t.emailMessageId),
	],
);

export const readStatus = sqliteTable(
	"read_status",
	{
		id: id(),
		conversationId: text()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		userId: text()
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lastReadMessageCount: integer().notNull().default(0),
		readAt: timestamp()
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("read_status_conv_user").on(t.conversationId, t.userId)],
);

export const usageEvent = sqliteTable(
	"usage_event",
	{
		id: id(),
		workspaceId: text()
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		conversationId: text().notNull(),
		messageId: text().notNull(),
		model: text().notNull(),
		promptTokens: integer().notNull().default(0),
		completionTokens: integer().notNull().default(0),
		costUsd: real().notNull().default(0),
		createdAt: createdAt(),
	},
	(t) => [index("usage_workspace_created").on(t.workspaceId, t.createdAt)],
);
