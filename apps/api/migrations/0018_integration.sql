-- Third-party integrations the agent can ACT through — Cal.com scheduling
-- (book calls, Zoom via the event type's location) and Shopify order actions
-- (order lookup, returns). One row per (project, kind); `config` is a JSON
-- blob validated against the kind's zod schema in @llmchat/shared before every
-- write. Credentials in `config` are server-side only: the dashboard API
-- returns a masked view, never the raw secret. Additive CREATE TABLE, matching
-- the ledger idiom — Ploy applies each migration file once, in filename order.
CREATE TABLE `integration` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_project_kind` ON `integration` (`project_id`,`kind`);
