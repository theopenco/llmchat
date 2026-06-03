-- Add multi-prompt support: separate table of named prompts per project,
-- with an active prompt pointer on project. Legacy `system_prompt` text
-- column on project remains as the fallback when no active prompt is set,
-- and is also seeded as the first row in `system_prompt` for existing rows.

ALTER TABLE `project` ADD COLUMN `active_system_prompt_id` text;
--> statement-breakpoint

CREATE TABLE `system_prompt` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `system_prompt_project` ON `system_prompt` (`project_id`);
--> statement-breakpoint

-- Seed: copy each project's existing systemPrompt as a "Default" prompt
-- and mark it active so behavior is preserved exactly.
INSERT INTO `system_prompt` (`id`, `project_id`, `name`, `content`)
SELECT
	lower(hex(randomblob(16))),
	`id`,
	'Default',
	`system_prompt`
FROM `project`
WHERE `system_prompt` != '';
--> statement-breakpoint

UPDATE `project`
SET `active_system_prompt_id` = (
	SELECT `id` FROM `system_prompt` WHERE `system_prompt`.`project_id` = `project`.`id` LIMIT 1
)
WHERE `system_prompt` != '';
