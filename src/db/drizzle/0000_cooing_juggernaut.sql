CREATE TYPE "public"."approval_source" AS ENUM('WEB', 'SMS', 'MANUAL', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'CANCEL', 'INVALIDATE', 'OVERRIDE', 'LOGIN', 'LOGOUT');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('LEAVE_REQUEST', 'LEAVE_EXTENSION', 'LEAVE_APPROVAL', 'QR_PASS', 'MOVEMENT_EVENT', 'POLICY', 'USER', 'STUDENT');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."hostel_gender" AS ENUM('MALE', 'FEMALE', 'MIXED');--> statement-breakpoint
CREATE TYPE "public"."leave_approval_decision" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED');--> statement-breakpoint
CREATE TYPE "public"."leave_category" AS ENUM('HOME_PASS', 'MEDICAL', 'LOCAL_OUTING', 'NIGHT_OUT', 'ACADEMIC');--> statement-breakpoint
CREATE TYPE "public"."leave_document_status" AS ENUM('ACTIVE', 'REPLACED', 'INVALID', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."movement_event" AS ENUM('LEAVE_APPROVED', 'EXIT_HOSTEL', 'ENTER_HOSTEL', 'AUTO_OVERDUE', 'MANUAL_RETURN', 'QR_INVALIDATED');--> statement-breakpoint
CREATE TYPE "public"."movement_method" AS ENUM('QR', 'MANUAL', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."movement_state" AS ENUM('IN_HOSTEL', 'APPROVED_LEAVE', 'CHECKED_OUT', 'OUTSIDE_HOSTEL', 'RETURNED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'SMS', 'PUSH', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'READ');--> statement-breakpoint
CREATE TYPE "public"."notification_event" AS ENUM('LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_EXTENSION_REQUESTED', 'LEAVE_EXTENSION_APPROVED', 'LEAVE_EXTENSION_REJECTED', 'LEAVE_OVERDUE', 'QR_GENERATED', 'QR_INVALIDATED');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('MAX_DAYS', 'BLOCK_DURING_PERIOD', 'RESTRICT_BATCH', 'REQUIRE_PARENT_APPROVAL', 'CURFEW_RESTRICTION', 'MAX_EXTENSION_COUNT');--> statement-breakpoint
CREATE TYPE "public"."qr_scan_result" AS ENUM('SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."qr_scan_type" AS ENUM('EXIT_SCAN', 'RETURN_SCAN');--> statement-breakpoint
CREATE TYPE "public"."qr_status" AS ENUM('ACTIVE', 'USED', 'EXPIRED', 'INVALIDATED');--> statement-breakpoint
CREATE TYPE "public"."qr_type" AS ENUM('LEAVE_EXIT', 'LEAVE_RETURN');--> statement-breakpoint
CREATE TYPE "public"."sheet_sync_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."sms_parsed_action" AS ENUM('APPROVE', 'REJECT', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."sms_processing_status" AS ENUM('RECEIVED', 'PARSED', 'PROCESSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."workflow_mode" AS ENUM('HOSTEL', 'ACADEMIC');--> statement-breakpoint
CREATE TABLE "academic_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"batch_year" integer NOT NULL,
	"group_code" text,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_groups_department_id_batch_year_group_code_unique" UNIQUE("department_id","batch_year","group_code")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"academic_group_id" uuid NOT NULL,
	"room_number" text,
	"roll_number" text NOT NULL,
	"current_location_state" text NOT NULL,
	"joined_at" date,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "students_roll_number_unique" UNIQUE("roll_number")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text,
	"hostel_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"gender" "gender",
	"profile_image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "hostels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"capacity" integer,
	"curfew_start_time" time,
	"curfew_end_time" time,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hostels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"relationship" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_student_phone_unq" UNIQUE("student_id","phone")
);
--> statement-breakpoint
CREATE TABLE "leave_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid,
	"leave_extension_id" uuid,
	"step_key" text NOT NULL,
	"step_order" integer NOT NULL,
	"approver_role_id" uuid,
	"approver_user_id" uuid,
	"approver_parent_id" uuid,
	"decision" "leave_approval_decision" NOT NULL,
	"approval_source" "approval_source" NOT NULL,
	"comments" text,
	"metadata" jsonb,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_approval_target_chk" CHECK (
        num_nonnulls(
          "leave_approvals"."leave_request_id",
          "leave_approvals"."leave_extension_id"
        ) = 1
      )
);
--> statement-breakpoint
CREATE TABLE "leave_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid,
	"leave_extension_id" uuid,
	"uploaded_by" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_status" "leave_document_status" DEFAULT 'ACTIVE' NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_document_target_chk" CHECK (
      num_nonnulls(
        "leave_documents"."leave_request_id",
        "leave_documents"."leave_extension_id"
      ) = 1
    )
);
--> statement-breakpoint
CREATE TABLE "leave_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"extension_number" integer NOT NULL,
	"current_end_at" timestamp with time zone NOT NULL,
	"requested_end_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_status" NOT NULL,
	"current_step_key" text,
	"current_step_order" integer,
	"approval_snapshot" jsonb,
	"policy_result" jsonb,
	"submitted_form" jsonb,
	"metadata" jsonb,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_extension_number_unq" UNIQUE("leave_request_id","extension_number")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"student_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "leave_status" NOT NULL,
	"current_step_key" text,
	"current_step_order" integer,
	"approval_snapshot" jsonb,
	"policy_result" jsonb,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"expected_return_at" timestamp with time zone,
	"actual_return_at" timestamp with time zone,
	"submitted_form" jsonb NOT NULL,
	"metadata" jsonb,
	"request_version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leave_type_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "leave_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" "leave_category" NOT NULL,
	"description" text,
	"form_schema" jsonb NOT NULL,
	"policy_config" jsonb,
	"notification_config" jsonb,
	"required_documents" jsonb,
	"ui_config" jsonb,
	"workflow_mode" "workflow_mode" NOT NULL,
	"default_workflow_id" uuid,
	"allow_extensions" boolean DEFAULT false NOT NULL,
	"max_extension_count" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "operational_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hostel_id" uuid,
	"name" text NOT NULL,
	"period_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"leave_request_id" uuid,
	"qr_pass_id" uuid,
	"event_type" "movement_event" NOT NULL,
	"from_state" text,
	"to_state" text,
	"movement_method" "movement_method" NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"metadata" jsonb,
	"recorded_by" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movement_states" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "qr_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"qr_type" "qr_type" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "qr_status" NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"first_scan_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_passes_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "qr_pass_leave_request_unq" UNIQUE("leave_request_id")
);
--> statement-breakpoint
CREATE TABLE "qr_scan_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_pass_id" uuid,
	"scanned_by" uuid,
	"scan_type" "qr_scan_type" NOT NULL,
	"scan_result" "qr_scan_result" NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"leave_request_id" uuid,
	"leave_extension_id" uuid,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"parsed_action" "sms_parsed_action",
	"processing_status" "sms_processing_status" NOT NULL,
	"provider_message_id" text,
	"metadata" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "inbound_sms_log_target_chk" CHECK (
        num_nonnulls(
          "inbound_sms_logs"."leave_request_id",
          "inbound_sms_logs"."leave_extension_id"
        ) = 1
      )
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid,
	"leave_extension_id" uuid,
	"user_id" uuid,
	"parent_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"event_type" "notification_event" NOT NULL,
	"recipient" text NOT NULL,
	"cc_recipients" jsonb,
	"delivery_status" "notification_delivery_status" NOT NULL,
	"provider_response" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_target_chk" CHECK (
        num_nonnulls(
          "notification_logs"."leave_request_id",
          "notification_logs"."leave_extension_id"
        ) = 1
      )
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject" text,
	"template_body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_template_event_channel_unq" UNIQUE("event_key","channel")
);
--> statement-breakpoint
CREATE TABLE "sheet_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_request_id" uuid,
	"leave_extension_id" uuid,
	"sync_event" text NOT NULL,
	"sync_status" "sheet_sync_status" NOT NULL,
	"response" text,
	"synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheet_sync_log_target_chk" CHECK (
        num_nonnulls(
          "sheet_sync_logs"."leave_request_id",
          "sheet_sync_logs"."leave_extension_id"
        ) = 1
      )
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"policy_type" "policy_type" NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"leave_type_id" uuid,
	"hostel_id" uuid,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_definitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"step_key" text NOT NULL,
	"step_order" integer NOT NULL,
	"approver_role_id" uuid,
	"is_parent_approval" boolean DEFAULT false NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_step_order_unq" UNIQUE("workflow_definition_id","step_order"),
	CONSTRAINT "workflow_step_key_unq" UNIQUE("workflow_definition_id","step_key")
);
--> statement-breakpoint
ALTER TABLE "academic_groups" ADD CONSTRAINT "academic_groups_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_academic_group_id_academic_groups_id_fk" FOREIGN KEY ("academic_group_id") REFERENCES "public"."academic_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_current_location_state_movement_states_code_fk" FOREIGN KEY ("current_location_state") REFERENCES "public"."movement_states"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_leave_extension_id_leave_extensions_id_fk" FOREIGN KEY ("leave_extension_id") REFERENCES "public"."leave_extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_approver_role_id_roles_id_fk" FOREIGN KEY ("approver_role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_approvals" ADD CONSTRAINT "leave_approvals_approver_parent_id_parents_id_fk" FOREIGN KEY ("approver_parent_id") REFERENCES "public"."parents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_leave_extension_id_leave_extensions_id_fk" FOREIGN KEY ("leave_extension_id") REFERENCES "public"."leave_extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_extensions" ADD CONSTRAINT "leave_extensions_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_default_workflow_id_workflow_definitions_id_fk" FOREIGN KEY ("default_workflow_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_periods" ADD CONSTRAINT "operational_periods_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_qr_pass_id_qr_passes_id_fk" FOREIGN KEY ("qr_pass_id") REFERENCES "public"."qr_passes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_from_state_movement_states_code_fk" FOREIGN KEY ("from_state") REFERENCES "public"."movement_states"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_to_state_movement_states_code_fk" FOREIGN KEY ("to_state") REFERENCES "public"."movement_states"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movement_events" ADD CONSTRAINT "movement_events_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_passes" ADD CONSTRAINT "qr_passes_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_passes" ADD CONSTRAINT "qr_passes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_qr_pass_id_qr_passes_id_fk" FOREIGN KEY ("qr_pass_id") REFERENCES "public"."qr_passes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan_logs" ADD CONSTRAINT "qr_scan_logs_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_sms_logs" ADD CONSTRAINT "inbound_sms_logs_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_sms_logs" ADD CONSTRAINT "inbound_sms_logs_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_sms_logs" ADD CONSTRAINT "inbound_sms_logs_leave_extension_id_leave_extensions_id_fk" FOREIGN KEY ("leave_extension_id") REFERENCES "public"."leave_extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_leave_extension_id_leave_extensions_id_fk" FOREIGN KEY ("leave_extension_id") REFERENCES "public"."leave_extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sync_logs" ADD CONSTRAINT "sheet_sync_logs_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_sync_logs" ADD CONSTRAINT "sheet_sync_logs_leave_extension_id_leave_extensions_id_fk" FOREIGN KEY ("leave_extension_id") REFERENCES "public"."leave_extensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_approver_role_id_roles_id_fk" FOREIGN KEY ("approver_role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_user_id_idx" ON "students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_academic_group_id_idx" ON "students" USING btree ("academic_group_id");--> statement-breakpoint
CREATE INDEX "audit_entity_lookup_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_hostel_id_idx" ON "users" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "hostels_code_idx" ON "hostels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "hostels_active_idx" ON "hostels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "parents_student_id_idx" ON "parents" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "parents_phone_idx" ON "parents" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "la_leave_request_id_idx" ON "leave_approvals" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "la_leave_extension_id_idx" ON "leave_approvals" USING btree ("leave_extension_id");--> statement-breakpoint
CREATE INDEX "la_approver_role_id_idx" ON "leave_approvals" USING btree ("approver_role_id");--> statement-breakpoint
CREATE INDEX "la_approver_user_id_idx" ON "leave_approvals" USING btree ("approver_user_id");--> statement-breakpoint
CREATE INDEX "la_decision_idx" ON "leave_approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "ld_leave_request_id_idx" ON "leave_documents" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "ld_leave_extension_id_idx" ON "leave_documents" USING btree ("leave_extension_id");--> statement-breakpoint
CREATE INDEX "ld_uploaded_by_idx" ON "leave_documents" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "ld_document_type_idx" ON "leave_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "leave_extensions_leave_request_id_idx" ON "leave_extensions" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "leave_extensions_extension_number_idx" ON "leave_extensions" USING btree ("leave_request_id","extension_number");--> statement-breakpoint
CREATE INDEX "leave_extensions_status_idx" ON "leave_extensions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_request_number_idx" ON "leave_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "leave_requests_student_id_idx" ON "leave_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "leave_requests_leave_type_id_idx" ON "leave_requests" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_requests_request_version_idx" ON "leave_requests" USING btree ("request_version");--> statement-breakpoint
CREATE INDEX "leave_requests_start_at_idx" ON "leave_requests" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "leave_requests_end_at_idx" ON "leave_requests" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "leave_types_code_idx" ON "leave_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "leave_types_active_idx" ON "leave_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "leave_types_workflow_mode_idx" ON "leave_types" USING btree ("workflow_mode");--> statement-breakpoint
CREATE INDEX "op_hostel_id_idx" ON "operational_periods" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "op_is_active_idx" ON "operational_periods" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "op_period_type_idx" ON "operational_periods" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "movement_events_student_id_idx" ON "movement_events" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "movement_events_leave_request_id_idx" ON "movement_events" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "movement_events_occurred_at_idx" ON "movement_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "movement_events_event_type_idx" ON "movement_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "qr_pass_leave_request_id_idx" ON "qr_passes" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "qr_pass_student_id_idx" ON "qr_passes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "qr_pass_status_idx" ON "qr_passes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "qr_scan_logs_qr_pass_id_idx" ON "qr_scan_logs" USING btree ("qr_pass_id");--> statement-breakpoint
CREATE INDEX "qr_scan_logs_scanned_by_idx" ON "qr_scan_logs" USING btree ("scanned_by");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_parent_id_idx" ON "inbound_sms_logs" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_leave_request_id_idx" ON "inbound_sms_logs" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_leave_extension_id_idx" ON "inbound_sms_logs" USING btree ("leave_extension_id");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_phone_idx" ON "inbound_sms_logs" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_processing_status_idx" ON "inbound_sms_logs" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "inbound_sms_logs_received_at_idx" ON "inbound_sms_logs" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "notification_logs_user_id_idx" ON "notification_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_logs_parent_id_idx" ON "notification_logs" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notification_logs_event_type_idx" ON "notification_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "notification_logs_delivery_status_idx" ON "notification_logs" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "notification_template_event_key_idx" ON "notification_templates" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "sheet_sync_logs_leave_request_id_idx" ON "sheet_sync_logs" USING btree ("leave_request_id");--> statement-breakpoint
CREATE INDEX "sheet_sync_logs_leave_extension_id_idx" ON "sheet_sync_logs" USING btree ("leave_extension_id");--> statement-breakpoint
CREATE INDEX "sheet_sync_logs_sync_event_idx" ON "sheet_sync_logs" USING btree ("sync_event");--> statement-breakpoint
CREATE INDEX "sheet_sync_logs_sync_status_idx" ON "sheet_sync_logs" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "sheet_sync_logs_created_at_idx" ON "sheet_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "policies_policy_type_idx" ON "policies" USING btree ("policy_type");--> statement-breakpoint
CREATE INDEX "policies_leave_type_id_idx" ON "policies" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "policies_hostel_id_idx" ON "policies" USING btree ("hostel_id");--> statement-breakpoint
CREATE INDEX "policies_is_active_idx" ON "policies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "policies_priority_idx" ON "policies" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "workflow_definition_code_idx" ON "workflow_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "workflow_definition_active_idx" ON "workflow_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "workflow_steps_workflow_id_idx" ON "workflow_steps" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_role_idx" ON "workflow_steps" USING btree ("approver_role_id");