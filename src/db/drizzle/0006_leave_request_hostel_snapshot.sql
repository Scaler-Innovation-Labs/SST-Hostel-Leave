ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "hostel_id" uuid;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "hostel_name" text;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "is_hostel_backfilled" boolean DEFAULT false NOT NULL;

DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "leave_requests_hostel_id_idx" ON "leave_requests" USING btree ("hostel_id");

-- Backfill existing legacy records with known current hostel assignment
-- Documented: Pre-migration records baseline against the student's currently assigned hostel.
-- If a student had no assigned hostel at migration time, hostel_id remains NULL (unknown/legacy unassigned).
-- Marked with is_hostel_backfilled = true to explicitly distinguish from real-time immutable snapshots.
UPDATE "leave_requests" lr
SET "hostel_id" = u."hostel_id",
    "hostel_name" = h."name",
    "is_hostel_backfilled" = true
FROM "students" s
JOIN "users" u ON s."user_id" = u."id"
LEFT JOIN "hostels" h ON u."hostel_id" = h."id"
WHERE lr."student_id" = s."id"
  AND lr."hostel_id" IS NULL
  AND u."hostel_id" IS NOT NULL;
