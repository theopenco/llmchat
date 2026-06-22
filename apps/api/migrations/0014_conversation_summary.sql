-- One-line AI triage summary per conversation, shown in the inbox list/detail
-- for at-a-glance scanning ("refund request for order #1234" instead of the raw
-- last-message snippet). Generated lazily on-view by a cheap model and CACHED
-- here; `summary_message_count` records the conversation.message_count the
-- summary reflects (the staleness marker — regenerate when message_count
-- advances). Both nullable: NULL `summary` = not generated yet (the UI falls
-- back to the existing snippet, never a placeholder); NULL `summary_message_count`
-- = never summarized. Additive ADD COLUMN matching the 0010 pattern; Ploy's
-- ledger applies each file once, in filename order.
--
-- PHASE 1 of 2 (deliberate migrate-before-serve split). Ploy's deploy ordering
-- between "apply migrations" and "new Worker serves traffic" is undocumented, so
-- this PR ships ONLY the columns — schema.ts is intentionally NOT changed, so the
-- live Worker never references a column that might not exist yet (the inbox is
-- the hottest path; no read can 500 on a missing column under any ordering). The
-- reading + generating code lands in a follow-up PR once these columns are live
-- in prod.
ALTER TABLE `conversation` ADD COLUMN `summary` text;
ALTER TABLE `conversation` ADD COLUMN `summary_message_count` integer;
