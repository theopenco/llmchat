-- Per-message visitor rating (thumbs up/down) for assistant replies.
-- Nullable: NULL = unrated. Only assistant messages are rateable, enforced in
-- the /v1/rating route rather than by a DB constraint. Additive ADD COLUMN,
-- matching the 0005 pattern; Ploy's migration ledger applies each file once.
ALTER TABLE `message` ADD COLUMN `rating` text;
