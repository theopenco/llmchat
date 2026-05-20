-- Backfill notify_email on the dev seed project for DBs that applied the
-- original 0001 seed before notify_email was added. No-op on fresh DBs
-- (those get notify_email directly from 0001).

UPDATE `project`
SET `notify_email` = 'admin@example.com'
WHERE `id` = 'dev-project' AND `notify_email` IS NULL;
