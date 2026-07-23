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
	// NOTE: the PLATFORM-admin role column (migration 0017_user_role.sql) is
	// deliberately NOT modeled on this Drizzle table. Better Auth's Drizzle
	// adapter loads the session user with an UNPROJECTED `select().from(user)`
	// (every column of this table object) on every getSession, so declaring
	// `role` here would make that auth hot-path query reference a column a preview
	// DB — which skips migrations — does not have, 500-ing ALL authenticated
	// requests. The /admin/* routes read `role` via an explicit `sql` projection
	// instead (fault-tolerant), so it's the only query that ever names the column.
	// (Distinct from the workspace-scoped `member.role`.) A future phase can fold
	// it into this table once prod has the column. See preview-deploys-skip-migrations.
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
	// Paid-only: new workspaces start at "none" (no active subscription →
	// entitled to nothing) until a Stripe Checkout completes and the webhook
	// promotes them to a paid tier. Legacy "free"/"pro" values resolve to "none"
	// via planEntitlements(). Entitlements live in @llmchat/shared (BILLING_TIERS).
	plan: text({ enum: ["none", "starter", "growth", "scale"] })
		.notNull()
		.default("none"),
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
		model: text().notNull().default("gpt-5.4-mini"),
		brandColor: text().notNull().default("#000000"),
		welcomeMessage: text().notNull().default("Hi! How can I help you today?"),
		escalationThreshold: integer().notNull().default(3),
		notifyEmail: text(),
		slackWebhookUrl: text(),
		// Absolute URL the widget's "agree to our privacy policy" notice links to.
		// Null → the widget falls back to the Clanker Support default policy.
		privacyPolicyUrl: text(),
		// Admin-defined starter questions the widget offers as tappable chips
		// before the visitor's first message. JSON array of strings.
		suggestedQuestions: text({ mode: "json" })
			.$type<string[]>()
			.notNull()
			.default([]),
		// Whether the widget asks for the visitor's name/email before chatting.
		// Off by default: the widget opens straight into the conversation.
		collectIdentity: integer({ mode: "boolean" }).notNull().default(false),
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
		// End-of-conversation CSAT (1–5 stars), prompted on widget close; null =
		// unrated. Distinct from per-message thumbs (message.rating). Range is
		// enforced in the /v1/csat route, not by a DB constraint.
		csatRating: integer(),
		// One-line AI triage summary for the inbox (cached). Nullable: NULL = not
		// generated yet → the inbox falls back to the message snippet, never a
		// placeholder. `summaryMessageCount` is the messageCount the summary
		// reflects (staleness marker — regenerate once messageCount advances).
		// Columns were shipped ahead of this code in migration 0014 (phase 1).
		summary: text(),
		summaryMessageCount: integer(),
		// Who resolved the conversation (the actor), recorded alongside archivedAt
		// (the resolve timestamp). "visitor" = clicked Resolve in the widget via
		// /v1/resolve; "admin" = operator resolved from the dashboard PATCH; "bot"
		// is RESERVED for a future auto-resolve path that doesn't exist yet (never
		// written). NULL = resolved before this column, or otherwise un-attributed
		// → the UI shows a plain "Resolved", never a guessed actor. Does not affect
		// status derivation (still archivedAt > escalatedAt > open). Column shipped
		// ahead of this code in migration 0015 (phase 1).
		resolvedBy: text(),
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

// Workspace-scoped labels an agent can attach to conversations. Name uniqueness
// is case-insensitive PER WORKSPACE — enforced by a COLLATE NOCASE unique index
// in the hand-authored migration (drizzle can't emit the collation here, so this
// uniqueIndex decl is cosmetic; the DB index + an app-level lower() dedupe are
// the real guarantees).
export const tag = sqliteTable(
	"tag",
	{
		id: id(),
		workspaceId: text()
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		name: text().notNull(),
		// Nullable: a tag created without a color is auto-assigned one server-side.
		color: text(),
		createdAt: createdAt(),
	},
	(t) => [uniqueIndex("tag_workspace_name").on(t.workspaceId, t.name)],
);

// Many-to-many join: which tags are attached to which conversation. Mirrors
// read_status (surrogate id + a unique pair index). Both FKs cascade, so
// deleting a conversation OR a tag removes the associations (no orphan rows).
export const conversationTag = sqliteTable(
	"conversation_tag",
	{
		id: id(),
		conversationId: text()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		tagId: text()
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("conversation_tag_unique").on(t.conversationId, t.tagId),
		index("conversation_tag_tag").on(t.tagId),
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
		// How this source was created / what it holds:
		//   "url"  — a fetched web page (the original v1 source; keeps a non-null url)
		//   "text" — manually-entered free text (no url)
		//   "qa"   — a Q&A pair promoted from an inbox reply (no url; see question/answer)
		// Default "url" so every pre-existing row backfills to the original kind.
		kind: text({ enum: ["url", "text", "qa"] })
			.notNull()
			.default("url"),
		// Nullable now: only "url" sources have a URL. text/qa sources have none.
		url: text(),
		title: text().notNull().default(""),
		content: text().notNull().default(""),
		// For "qa" sources: the question/answer kept separately from `content` so the
		// pair can be displayed/edited later without re-parsing the "Q:/A:" blob.
		question: text(),
		answer: text(),
		// Provenance + dedupe for promoted Q&A: the message this was promoted from.
		// Lets a repeated promote of the same reply no-op instead of duplicating.
		sourceMessageId: text(),
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

// Third-party integrations the agent can ACT through (Cal.com scheduling,
// Shopify order actions). One row per (project, kind); `config` is a JSON blob
// validated by the kind's zod schema in @llmchat/shared (apiKey/eventTypeId for
// calcom, shopDomain/accessToken for shopify). Credentials live server-side
// only — the dashboard API returns a masked view, never the raw config.
export const integration = sqliteTable(
	"integration",
	{
		id: id(),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		kind: text({ enum: ["calcom", "shopify"] }).notNull(),
		enabled: integer({ mode: "boolean" }).notNull().default(true),
		config: text().notNull().default("{}"),
		createdAt: createdAt(),
		updatedAt: timestamp()
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("integration_project_kind").on(t.projectId, t.kind)],
);

// Durable, operator-visible audit trail of every action the AGENT took on a
// visitor's behalf (Cal.com booking, Shopify order lookup / return). Append-only.
// `params` is the sanitized tool input (order number, email, slot, item titles)
// — NEVER credentials. `ok` records whether the upstream action succeeded; a
// blocked/refused attempt is logged with ok=false so abuse is visible. Surfaced
// in the dashboard conversation thread so a mistaken or abusive return/booking
// can be seen (and reversed in Shopify/Cal.com) instead of being invisible.
export const agentAction = sqliteTable(
	"agent_action",
	{
		id: id(),
		conversationId: text()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		projectId: text()
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		workspaceId: text()
			.notNull()
			.references(() => workspace.id, { onDelete: "cascade" }),
		kind: text({ enum: ["calcom", "shopify"] }).notNull(),
		tool: text().notNull(),
		ok: integer({ mode: "boolean" }).notNull(),
		// Short human summary for the operator ("filed return #1001-R1 …").
		detail: text(),
		// Sanitized tool inputs as JSON — never secrets.
		params: text().notNull().default("{}"),
		createdAt: createdAt(),
	},
	(t) => [index("agent_action_conv").on(t.conversationId, t.createdAt)],
);

export const message = sqliteTable(
	"message",
	{
		id: id(),
		conversationId: text()
			.notNull()
			.references(() => conversation.id, { onDelete: "cascade" }),
		// "note" = operator-internal annotation: rendered only in the dashboard
		// thread, excluded from every visitor/model/email surface via the role
		// ALLOWLISTS in @llmchat/shared (VISITOR_VISIBLE_ROLES / RECAP_ROLES /
		// HISTORY_ROLES / QUOTABLE_ROLES — all four side by side there). TS-only
		// enum — the column is plain text in SQL (no CHECK), so widening it needs
		// no migration.
		role: text({
			enum: ["user", "assistant", "admin", "system", "note"],
		}).notNull(),
		content: text().notNull(),
		sequence: integer().notNull(),
		// Visitor thumbs rating on an assistant reply; null = unrated. Only
		// assistant messages are rateable (enforced in the /v1/rating route).
		rating: text({ enum: ["up", "down"] }),
		// Author for admin messages and internal notes; null for user/assistant
		// (and scrubbed to null when the authoring account is deleted).
		authorUserId: text().references(() => user.id),
		// Quote-reply: the earlier message in the SAME conversation this one is
		// replying to (the widget's "Replying to:" affordance); null = not a reply.
		// Deliberately NOT .references(message.id): migration 0022 adds a bare text
		// column with no FK clause, so declaring one here would describe a constraint
		// the DB does not have (and a self-reference needs an AnySQLiteColumn
		// annotation to break drizzle's circular type inference). The reference is
		// validated in /v1/chat — and(id, conversationId), so a foreign or unknown id
		// is never stored — and a dangling id (quoted message deleted) is harmless:
		// both clients resolve the target from the loaded thread and fall back to a
		// neutral "earlier message" chip.
		replyToMessageId: text(),
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
