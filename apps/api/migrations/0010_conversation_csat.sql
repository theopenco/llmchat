-- End-of-conversation CSAT (1–5 star) rating, prompted on widget close.
-- Nullable: NULL = unrated. Distinct from per-message thumbs (message.rating).
-- Range is enforced in the /v1/csat route, not by a DB constraint. Additive
-- ADD COLUMN matching the 0005/0009 pattern; Ploy's ledger applies each file once.
ALTER TABLE `conversation` ADD COLUMN `csat_rating` integer;
