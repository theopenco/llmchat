-- Uploaded widget avatar ("Agent photo"). New TABLE, not a project column
-- (#167 note: preview DBs skip migrations, so a table degrades only this
-- feature), and kept out of the hot-path GET /projects list. One row per
-- project; upload is an upsert on the PK. data is base64 text — small by
-- construction (dashboard downscales to a ≤256px square, api caps payload).
CREATE TABLE `project_avatar` (
	`project_id` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
