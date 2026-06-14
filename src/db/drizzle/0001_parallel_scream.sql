ALTER TYPE "public"."notification_event" ADD VALUE 'LEAVE_CANCELLED' BEFORE 'LEAVE_EXTENSION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."notification_event" ADD VALUE 'LEAVE_COMPLETED' BEFORE 'LEAVE_EXTENSION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."notification_event" ADD VALUE 'LEAVE_EXPIRED' BEFORE 'LEAVE_EXTENSION_REQUESTED';--> statement-breakpoint
ALTER TYPE "public"."notification_event" ADD VALUE 'PARENT_APPROVAL_REQUESTED' BEFORE 'QR_GENERATED';--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD COLUMN "parent_approval_token" text;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD COLUMN "parent_approval_otp_hash" text;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD COLUMN "parent_approval_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD COLUMN "parent_approval_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "la_parent_token_idx" ON "leave_approvals" USING btree ("parent_approval_token");--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_parent_approval_token_unique" UNIQUE("parent_approval_token");