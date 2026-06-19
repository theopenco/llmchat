-- Paid-only billing tiers: the workspace.plan enum moves from
-- free|pro|scale to none|starter|growth|scale, and the column default moves
-- from 'free' to 'none' (a new workspace has no active subscription until a
-- Stripe Checkout completes). Entitlements live in @llmchat/shared
-- (BILLING_TIERS); planEntitlements() resolves any unknown/legacy value to
-- 'none', so this remap of pre-existing 'free'/'pro' rows is belt-and-braces.
--
-- SQLite can't ALTER a column default, so the workspace table is recreated
-- (the same copy/drop/rename dance drizzle emits), scoped to this one table to
-- stay incremental like 0003–0010. Ploy's ledger applies each file once.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan` text DEFAULT 'none' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workspace`("id", "name", "owner_id", "stripe_customer_id", "stripe_subscription_id", "plan", "created_at") SELECT "id", "name", "owner_id", "stripe_customer_id", "stripe_subscription_id", "plan", "created_at" FROM `workspace`;
--> statement-breakpoint
DROP TABLE `workspace`;
--> statement-breakpoint
ALTER TABLE `__new_workspace` RENAME TO `workspace`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
UPDATE `workspace` SET `plan` = 'none' WHERE `plan` NOT IN ('none', 'starter', 'growth', 'scale');
