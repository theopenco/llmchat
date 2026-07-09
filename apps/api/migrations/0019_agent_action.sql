-- Durable, operator-visible audit trail of every action the AGENT took on a
-- visitor's behalf — Cal.com bookings and Shopify order lookups / returns.
-- Append-only; `params` is the sanitized tool input (order number, email, slot,
-- item titles) and NEVER holds credentials. `ok` records the upstream outcome
-- (a blocked/refused attempt is stored with ok=0 so abuse is visible). Surfaced
-- in the dashboard conversation thread so a mistaken or abusive return/booking
-- can be seen and reversed in Shopify/Cal.com instead of being invisible.
-- Additive CREATE TABLE, matching the ledger idiom — Ploy applies each migration
-- file once, in filename order.
CREATE TABLE `agent_action` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`project_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`tool` text NOT NULL,
	`ok` integer NOT NULL,
	`detail` text,
	`params` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_action_conv` ON `agent_action` (`conversation_id`,`created_at`);
