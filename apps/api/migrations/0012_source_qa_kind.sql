-- Source kinds: a source is no longer URL-only. Add `kind` (url|text|qa), make
-- `url` nullable (text/qa sources have none), and add `question`/`answer` (qa
-- display/edit) + `source_message_id` (provenance + dedupe for replies promoted
-- into knowledge).
--
-- Additive + backfill: existing rows are all fetched web pages, so they take
-- kind='url' (the column default) and keep their non-null url untouched. Making
-- a column nullable can't be done with ALTER in SQLite, so the table is
-- recreated with the same copy/drop/rename dance drizzle emits — scoped to this
-- one table to stay incremental like 0003–0011. Ploy's ledger applies each file
-- once (in filename order, so this runs after 0011), on `ploy dev` and on deploy.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_source` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text DEFAULT 'url' NOT NULL,
	`url` text,
	`title` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`question` text,
	`answer` text,
	`source_message_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`last_fetched_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_source`("id", "project_id", "url", "title", "content", "active", "last_fetched_at", "last_error", "created_at", "updated_at") SELECT "id", "project_id", "url", "title", "content", "active", "last_fetched_at", "last_error", "created_at", "updated_at" FROM `source`;--> statement-breakpoint
DROP TABLE `source`;--> statement-breakpoint
ALTER TABLE `__new_source` RENAME TO `source`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `source_project` ON `source` (`project_id`);--> statement-breakpoint
-- Belt-and-braces backfill: every carried-over row is a fetched URL source. The
-- column default already sets this on recreate; this makes it explicit/idempotent.
UPDATE `source` SET `kind` = 'url' WHERE `kind` IS NULL OR `kind` NOT IN ('url', 'text', 'qa');
