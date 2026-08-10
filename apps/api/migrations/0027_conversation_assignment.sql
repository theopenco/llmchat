-- Conversation assignment (#96, docs/goals/assignment.md). New TABLE, not a
-- column (R1 Option B): un-migrated preview DBs degrade only the assignment
-- feature itself (#167 drizzle note; 0026/workspace_invite precedent). Max one
-- assignee per conversation = the PRIMARY KEY on conversation_id; reassign is
-- an upsert, claim-on-reply is INSERT .. ON CONFLICT DO NOTHING (first-wins).
-- workspace_id is denormalized for direct tenant scoping + set-based cleanup.
-- Cleanup is EXPLICIT (lib/workspace-deletion.ts, members.ts) — never rely on
-- the FK cascades.
CREATE TABLE `conversation_assignment` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`assignee_user_id` text NOT NULL,
	`assigned_by` text,
	`assigned_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversation_assignment_assignee` ON `conversation_assignment` (`workspace_id`,`assignee_user_id`);
