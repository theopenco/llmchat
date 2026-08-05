-- Member invites (docs/goals/invites.md). New TABLE, not a column: un-migrated
-- preview DBs degrade only the invites feature itself (#167 drizzle note).
CREATE TABLE `workspace_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,          -- 'admin' | 'agent'; owner never invitable (R3)
	`token_hash` text NOT NULL,                     -- SHA-256 hex; plaintext never stored (R1)
	`created_by` text,                              -- nullable so account deletion can scrub (S6 pattern)
	`accepted_by` text,                             -- audit only, no FK
	`expires_at` integer NOT NULL,                  -- unix seconds; proposal: 7 days
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invite_token_hash` ON `workspace_invite` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `workspace_invite_workspace` ON `workspace_invite` (`workspace_id`);
