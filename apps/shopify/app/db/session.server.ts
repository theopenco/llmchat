import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Shopify session table for DrizzleSessionStorageSQLite, column-for-column
 * the adapter's reference schema (the package ships it as source only —
 * @shopify/shopify-app-session-storage-drizzle/src/schemas/sqlite.schema.ts —
 * you're meant to own the table). Column names are camelCase on purpose:
 * the adapter addresses them literally; do NOT snake_case them.
 *
 * The DDL twin lives in migrations/0001_create_session.sql (hand-authored,
 * house rule) — the session-storage test applies that SQL and runs the real
 * adapter against it, so schema/migration drift fails CI.
 */
export const sessionTable = sqliteTable("session", {
	id: text("id").primaryKey(),
	shop: text("shop").notNull(),
	state: text("state").notNull(),
	isOnline: integer("isOnline", { mode: "boolean" }).notNull().default(false),
	scope: text("scope"),
	expires: text("expires"),
	accessToken: text("accessToken").notNull(),
	// Always NULL for this app (offline tokens only — the adapter writes it
	// from onlineAccessInfo). If online tokens are ever enabled, verify the
	// BLOB-bigint write path on REAL D1 first: drizzle emits a Node Buffer,
	// and workerd's D1 has rejected typed-array views on some versions —
	// the better-sqlite3-backed contract test cannot catch that.
	userId: blob("userId", { mode: "bigint" }),
	firstName: text("firstName"),
	lastName: text("lastName"),
	email: text("email"),
	accountOwner: integer("accountOwner", { mode: "boolean" }),
	locale: text("locale"),
	collaborator: integer("collaborator", { mode: "boolean" }),
	emailVerified: integer("emailVerified", { mode: "boolean" }),
	refreshToken: text("refreshToken"),
	refreshTokenExpires: text("refreshTokenExpires"),
});
