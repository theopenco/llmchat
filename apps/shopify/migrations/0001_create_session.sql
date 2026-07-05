-- Shopify session storage (DrizzleSessionStorageSQLite over the SESSION_DB
-- D1 binding). Hand-authored twin of app/db/session.server.ts — camelCase
-- column names are the adapter's contract, not a style slip. Applied by
-- Ploy's migration scan (migrations/*.sql) and by
-- `wrangler d1 migrations apply SESSION_DB --local` in dev.
CREATE TABLE IF NOT EXISTS "session" (
	"id" TEXT PRIMARY KEY NOT NULL,
	"shop" TEXT NOT NULL,
	"state" TEXT NOT NULL,
	"isOnline" INTEGER NOT NULL DEFAULT 0,
	"scope" TEXT,
	"expires" TEXT,
	"accessToken" TEXT NOT NULL,
	"userId" BLOB,
	"firstName" TEXT,
	"lastName" TEXT,
	"email" TEXT,
	"accountOwner" INTEGER,
	"locale" TEXT,
	"collaborator" INTEGER,
	"emailVerified" INTEGER,
	"refreshToken" TEXT,
	"refreshTokenExpires" TEXT
);

-- findSessionsByShop is the hot lookup (every webhook cleanup).
CREATE INDEX IF NOT EXISTS "session_shop_idx" ON "session" ("shop");
