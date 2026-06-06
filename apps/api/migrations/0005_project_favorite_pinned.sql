ALTER TABLE `project` ADD COLUMN `favorite` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `project` ADD COLUMN `pinned` integer DEFAULT 0 NOT NULL;
