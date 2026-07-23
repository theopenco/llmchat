DROP TABLE IF EXISTS _seq_backfill_0023;
--> statement-breakpoint
CREATE TABLE _seq_backfill_0023 AS
	SELECT id AS mid,
		ROW_NUMBER() OVER (PARTITION BY conversation_id
			ORDER BY sequence, created_at, id) AS new_seq
	FROM message
	WHERE conversation_id IN (
		SELECT conversation_id FROM message
		GROUP BY conversation_id, sequence HAVING COUNT(*) > 1);
--> statement-breakpoint
UPDATE message
SET sequence = (SELECT new_seq FROM _seq_backfill_0023 WHERE mid = message.id)
WHERE id IN (SELECT mid FROM _seq_backfill_0023);
--> statement-breakpoint
DROP TABLE _seq_backfill_0023;
--> statement-breakpoint
UPDATE conversation
SET message_count = (SELECT COUNT(*) FROM message m WHERE m.conversation_id = conversation.id)
WHERE message_count <> (SELECT COUNT(*) FROM message m WHERE m.conversation_id = conversation.id);
