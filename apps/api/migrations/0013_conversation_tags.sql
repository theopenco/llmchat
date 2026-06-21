-- Conversation tags/labels. Purely additive: two new tables + indexes, NO
-- rewrite of any existing/populated table (unlike 0012, which had to recreate
-- `source`), so this is low-risk. drizzle-kit generate is unusable here (the
-- journal is frozen → it tries to drop/recreate project/workspace), so this is
-- hand-authored and scoped to only the new tables, like 0012. Ploy's ledger
-- applies each migrations/*.sql once, in filename order (so this runs after
-- 0012), each file in a transaction.
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Case-insensitive uniqueness per workspace: "Billing" and "billing" can't both
-- exist. NOCASE folds ASCII case only; the API also dedupes via lower(name).
CREATE UNIQUE INDEX `tag_workspace_name` ON `tag` (`workspace_id`, `name` COLLATE NOCASE);
--> statement-breakpoint
CREATE TABLE `conversation_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- One association per (conversation, tag): makes attach idempotent at the DB level.
CREATE UNIQUE INDEX `conversation_tag_unique` ON `conversation_tag` (`conversation_id`, `tag_id`);
--> statement-breakpoint
-- Index the tag side for the list's tagIds filter (tag → conversations).
CREATE INDEX `conversation_tag_tag` ON `conversation_tag` (`tag_id`);
