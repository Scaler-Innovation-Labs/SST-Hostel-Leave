CREATE TYPE "public"."approval_method" AS ENUM('PORTAL', 'OTP', 'SMS_REPLY', 'EMAIL_LINK', 'AUTO');--> statement-breakpoint
ALTER TYPE "public"."approval_source" ADD VALUE 'PORTAL';--> statement-breakpoint
ALTER TYPE "public"."approval_source" ADD VALUE 'SMS_REPLY';--> statement-breakpoint
ALTER TYPE "public"."approval_source" ADD VALUE 'EMAIL_LINK';--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD COLUMN "approval_method" "approval_method";