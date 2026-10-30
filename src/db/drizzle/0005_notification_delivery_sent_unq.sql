CREATE UNIQUE INDEX IF NOT EXISTS "notification_logs_outbox_delivery_sent_unq" 
ON "notification_logs" USING btree (("metadata"->>'outboxEventId'), "channel", "recipient") 
WHERE "delivery_status" = 'SENT' AND ("metadata"->>'outboxEventId') IS NOT NULL;
