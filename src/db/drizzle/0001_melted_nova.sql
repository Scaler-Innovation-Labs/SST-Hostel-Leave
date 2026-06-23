CREATE TYPE "public"."notification_recipient_type" AS ENUM('STUDENT', 'PARENT', 'CURRENT_APPROVER', 'PREVIOUS_APPROVER', 'ALL_APPROVERS', 'WARDEN', 'POC', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
ALTER TYPE "public"."leave_approval_decision" ADD VALUE 'CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."movement_event" ADD VALUE 'MANUAL_CHECKOUT' BEFORE 'QR_INVALIDATED';--> statement-breakpoint
ALTER TYPE "public"."movement_event" ADD VALUE 'SECURITY_OVERRIDE' BEFORE 'QR_INVALIDATED';--> statement-breakpoint
ALTER TYPE "public"."notification_channel" ADD VALUE 'SLACK';--> statement-breakpoint
ALTER TYPE "public"."policy_type" ADD VALUE 'FORM_FIELD_RESTRICTION';--> statement-breakpoint
CREATE TABLE "notification_rule_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	CONSTRAINT "notification_rule_channel_unq" UNIQUE("rule_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_rule_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"recipient_type" "notification_recipient_type" NOT NULL,
	CONSTRAINT "notification_rule_recipient_unq" UNIQUE("rule_id","recipient_type")
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_type_id" uuid,
	"event_type" "notification_event" NOT NULL,
	"template_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"custom_recipients" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qr_passes" DROP CONSTRAINT "qr_pass_leave_request_unq";--> statement-breakpoint
ALTER TABLE "workflow_steps" ALTER COLUMN "approval_method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."approval_method";--> statement-breakpoint
CREATE TYPE "public"."approval_method" AS ENUM('SMS_REPLY', 'SMS_AND_LINK', 'SMS_LINK', 'PORTAL', 'AUTO');--> statement-breakpoint
ALTER TABLE "workflow_steps" ALTER COLUMN "approval_method" SET DATA TYPE "public"."approval_method" USING "approval_method"::"public"."approval_method";--> statement-breakpoint
ALTER TABLE "leave_types" ADD COLUMN "use_global_notification_rules" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "batch_year" integer;--> statement-breakpoint
ALTER TABLE "notification_rule_channels" ADD CONSTRAINT "notification_rule_channels_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rule_recipients" ADD CONSTRAINT "notification_rule_recipients_rule_id_notification_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."notification_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_rules_leave_type_event_idx" ON "notification_rules" USING btree ("leave_type_id","event_type");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "students_cur_loc_state_idx" ON "students" USING btree ("current_location_state");--> statement-breakpoint
CREATE INDEX "la_approver_parent_id_idx" ON "leave_approvals" USING btree ("approver_parent_id");--> statement-breakpoint
CREATE INDEX "la_parent_expiry_idx" ON "leave_approvals" USING btree ("parent_approval_expires_at");--> statement-breakpoint
CREATE INDEX "la_request_decision_step_idx" ON "leave_approvals" USING btree ("leave_request_id","decision","step_order");--> statement-breakpoint
CREATE INDEX "la_extension_decision_step_idx" ON "leave_approvals" USING btree ("leave_extension_id","decision","step_order");--> statement-breakpoint
CREATE INDEX "la_parent_decision_created_idx" ON "leave_approvals" USING btree ("approver_parent_id","decision","created_at");--> statement-breakpoint
CREATE INDEX "lr_student_dates_idx" ON "leave_requests" USING btree ("student_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "lr_status_endat_return_idx" ON "leave_requests" USING btree ("status","end_at","actual_return_at");--> statement-breakpoint
CREATE INDEX "lr_status_created_idx" ON "leave_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "op_dates_idx" ON "operational_periods" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "me_student_occurred_idx" ON "movement_events" USING btree ("student_id","occurred_at");--> statement-breakpoint
CREATE INDEX "me_request_occurred_idx" ON "movement_events" USING btree ("leave_request_id","occurred_at");--> statement-breakpoint
CREATE INDEX "notification_logs_leave_request_id_idx" ON "notification_logs" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "oe_status_created_idx" ON "outbox_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "policies_department_id_idx" ON "policies" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "policies_batch_year_idx" ON "policies" USING btree ("batch_year");--> statement-breakpoint
ALTER TABLE "qr_passes" ADD CONSTRAINT "qr_pass_leave_request_qr_type_unq" UNIQUE("leave_request_id","qr_type");--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_code_unique" UNIQUE("code");