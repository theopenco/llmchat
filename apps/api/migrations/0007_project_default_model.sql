-- Change the project.model column default to a current web-search model.
-- SQLite can't ALTER a column default in place, so rebuild the table (the
-- standard drizzle pattern). Only the `model` default changes; all data,
-- columns, and indexes are preserved.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`public_key` text NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`active_system_prompt_id` text,
	`favorite` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`knowledge_text` text DEFAULT '' NOT NULL,
	`model` text DEFAULT 'gpt-5.4-mini' NOT NULL,
	`brand_color` text DEFAULT '#000000' NOT NULL,
	`welcome_message` text DEFAULT 'Hi! How can I help you today?' NOT NULL,
	`escalation_threshold` integer DEFAULT 3 NOT NULL,
	`notify_email` text,
	`slack_webhook_url` text,
	`inbound_email_local` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "workspace_id", "name", "public_key", "system_prompt", "active_system_prompt_id", "favorite", "pinned", "knowledge_text", "model", "brand_color", "welcome_message", "escalation_threshold", "notify_email", "slack_webhook_url", "inbound_email_local", "created_at") SELECT "id", "workspace_id", "name", "public_key", "system_prompt", "active_system_prompt_id", "favorite", "pinned", "knowledge_text", "model", "brand_color", "welcome_message", "escalation_threshold", "notify_email", "slack_webhook_url", "inbound_email_local", "created_at" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `project_publicKey_unique` ON `project` (`public_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_inboundEmailLocal_unique` ON `project` (`inbound_email_local`);--> statement-breakpoint
CREATE INDEX `project_workspace` ON `project` (`workspace_id`);
