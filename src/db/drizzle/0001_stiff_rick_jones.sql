ALTER TABLE "outbox_events" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "oe_status_published_idx" ON "outbox_events" USING btree ("status","published_at");